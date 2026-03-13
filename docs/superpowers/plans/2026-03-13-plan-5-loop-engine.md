# Plan 5: Loop Engine & Orchestration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Loop Engine — the autonomous execution system that takes a user request, decomposes it into stories via the Arbiter, and iterates through them with fresh agent sessions, quality gates, and circuit breakers. Plus orchestration patterns for multi-agent coordination.

**Architecture:** Rust state machine drives the loop lifecycle. Each iteration spawns a fresh agent PTY session via per-agent `PromptDelivery` strategy. The Arbiter (Plan 4) provides all intelligence (task selection, completion judgment, memory extraction). Loop state persists in SQLite for crash recovery. Multi-agent parallelism uses the existing PTY manager with cross-agent memory sharing.

**Tech Stack:** Rust (rusqlite, tokio, portable-pty), TypeScript/React (Mantine), Tauri IPC + events

**Spec:** `docs/superpowers/specs/2026-03-13-arbiter-extensions-design.md` — Sections 5 and 6

---

**What Plan 1 built:**
- SQLite database with `arbiter_state` and `stories` tables
- PTY management system (spawn, write, resize, kill)
- Agent registry with detection patterns (idle, input, finished)
- `DbPool` in AppState

**What Plan 2 built:**
- Context Store with L0/L1/L2 tiered loading
- Context assignment system (session + project defaults)
- `copy_defaults_to_session()` for new session setup

**What Plan 3 built:**
- Memory extraction from terminal output
- FTS5 memory search with scored retrieval
- Background consolidation worker
- `search_memories()` for loading relevant context

**What Plan 4 built:**
- 7 Arbiter action types with prompt templates and dispatch
- `DecomposeRequest` — user request -> stories in DB
- `SelectNextStory` — plan + memory -> next story ID
- `JudgeCompletion` — test output + criteria -> pass/fail
- `ExtractMemories` — terminal output -> structured facts
- Trust levels per project (Supervised/Autonomous/Full Auto)
- Arbiter state tracking (loop_status, current_story_id, iteration_count)
- Stories CRUD with dependency-aware next-story selection

**What this plan builds:**
- `PromptDelivery` enum on `AgentDefinition`
- Loop Engine state machine (Rust)
- Loop lifecycle: start -> iterate -> quality gates -> complete/fail
- Per-agent prompt delivery (InteractiveInput, PositionalArg, CliFlag)
- Completion detection (process exit, finished pattern, idle timeout)
- Quality gates (configurable build/lint/typecheck/test commands)
- Circuit breakers (max retries, idle detection, iteration limit)
- Loop user controls (start/pause/resume/cancel/edit/intervene)
- Multi-agent parallel execution for independent stories
- Orchestration patterns (sequential/parallel/collaborative)
- Loop progress UI with story status, diffs, arbiter reasoning
- Promptfoo dev integration (optional, dev-time only)

---

## File Structure

### New Files
- `src-tauri/src/loop_engine/mod.rs` — module
- `src-tauri/src/loop_engine/engine.rs` — main loop state machine
- `src-tauri/src/loop_engine/prompt_delivery.rs` — per-agent prompt injection
- `src-tauri/src/loop_engine/quality_gates.rs` — gate runner
- `src-tauri/src/loop_engine/circuit_breaker.rs` — circuit breaker logic
- `src-tauri/src/loop_engine/orchestrator.rs` — multi-agent coordination
- `src-tauri/src/commands/loop_commands.rs` — Tauri IPC commands
- `src/features/loop/components/LoopPanel.tsx` — main loop UI
- `src/features/loop/components/StoryList.tsx` — stories with status indicators
- `src/features/loop/components/StoryEditor.tsx` — edit/add stories
- `src/features/loop/components/LoopControls.tsx` — start/pause/resume/cancel buttons
- `src/features/loop/components/LoopProgress.tsx` — iteration counter, circuit breaker status
- `src/features/loop/components/ArbiterReasoningLog.tsx` — reasoning entries
- `src/stores/loopStore.ts` — Zustand store for loop state
- `promptfoo.yaml` — (optional) dev-time Arbiter prompt testing config

### Modified Files
- `src-tauri/src/agents/registry.rs` — add `prompt_delivery` field to each agent
- `src-tauri/src/state.rs` — add PromptDelivery enum, QualityGateConfig, LoopConfig
- `src-tauri/src/commands/mod.rs` — add loop_commands
- `src-tauri/src/lib.rs` — register loop commands, add loop_engine module
- `src/types/index.ts` — add LoopState, QualityGate, LoopEvent types
- `src/lib/tauri.ts` — add loop IPC functions

---

## Chunk 1: Agent Registry Extension & Prompt Delivery

### Task 1: Add PromptDelivery to agent system

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/agents/registry.rs`

- [ ] **Step 1: Add PromptDelivery enum**

In `state.rs`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PromptDelivery {
    CliFlag(String),      // e.g., "-p"
    PositionalArg,        // prompt as first arg
    InteractiveInput,     // wait for idle, write to PTY
}
```

Add to `AgentDefinition`:
```rust
pub prompt_delivery: Option<PromptDelivery>,  // None = not loop-capable
```

- [ ] **Step 2: Set prompt_delivery per agent in registry**

In `registry.rs`, update each agent definition:
```rust
// Claude
prompt_delivery: Some(PromptDelivery::InteractiveInput),

// Gemini
prompt_delivery: Some(PromptDelivery::InteractiveInput),

// Codex
prompt_delivery: Some(PromptDelivery::PositionalArg),

// Copilot
prompt_delivery: Some(PromptDelivery::InteractiveInput),

// Terminal
prompt_delivery: None,  // Not loop-capable
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/agents/registry.rs
git commit -m "feat: add PromptDelivery to agent definitions"
```

### Task 2: Implement prompt delivery module

**Files:**
- Create: `src-tauri/src/loop_engine/mod.rs`
- Create: `src-tauri/src/loop_engine/prompt_delivery.rs`

- [ ] **Step 1: Create module**

`src-tauri/src/loop_engine/mod.rs`:
```rust
pub mod engine;
pub mod prompt_delivery;
pub mod quality_gates;
pub mod circuit_breaker;
pub mod orchestrator;
```

- [ ] **Step 2: Implement prompt delivery**

`src-tauri/src/loop_engine/prompt_delivery.rs`:
```rust
use crate::state::{PromptDelivery, AgentDefinition};
use crate::pty::manager::PtyManager;

/// Deliver a prompt to an agent session based on its delivery strategy
pub async fn deliver_prompt(
    pty_manager: &mut PtyManager,
    session_id: &str,
    agent_def: &AgentDefinition,
    prompt: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    match &agent_def.prompt_delivery {
        Some(PromptDelivery::InteractiveInput) => {
            // Agent is already spawned and running
            // Wait for idle pattern to appear (agent is ready for input)
            // Write prompt text to PTY followed by Enter
            let bytes: Vec<u8> = format!("{}\r", prompt).into_bytes();
            pty_manager.write(session_id, &bytes).map_err(|e| e.to_string())?;
            Ok(())
        }
        Some(PromptDelivery::CliFlag(flag)) => {
            // Prompt was already passed as CLI arg during spawn
            // Nothing to do here — the agent received it at launch
            Ok(())
        }
        Some(PromptDelivery::PositionalArg) => {
            // Prompt was already passed as positional arg during spawn
            Ok(())
        }
        None => Err("Agent is not loop-capable".to_string()),
    }
}

/// Build the spawn arguments for an agent, potentially including the prompt
pub fn build_spawn_args(
    agent_def: &AgentDefinition,
    prompt: &str,
    yolo_mode: bool,
) -> Vec<String> {
    let mut args = agent_def.default_args.clone();
    if yolo_mode && !agent_def.yolo_flag.is_empty() {
        args.push(agent_def.yolo_flag.clone());
    }
    match &agent_def.prompt_delivery {
        Some(PromptDelivery::CliFlag(flag)) => {
            args.push(flag.clone());
            args.push(prompt.to_string());
        }
        Some(PromptDelivery::PositionalArg) => {
            args.push(prompt.to_string());
        }
        _ => {
            // InteractiveInput — prompt delivered after spawn via PTY write
        }
    }
    args
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/loop_engine/
git commit -m "feat: implement prompt delivery strategies for loop engine"
```

---

## Chunk 2: Quality Gates & Circuit Breakers

### Task 3: Add quality gate types and config

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add QualityGateConfig**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGateConfig {
    pub build_command: Option<String>,
    pub lint_command: Option<String>,
    pub typecheck_command: Option<String>,
    pub test_command: Option<String>,
    pub arbiter_judge: bool,  // whether to use LLM to judge completion
}

impl Default for QualityGateConfig {
    fn default() -> Self {
        Self {
            build_command: None,
            lint_command: None,
            typecheck_command: None,
            test_command: None,
            arbiter_judge: true,
        }
    }
}
```

Add to Project struct or as a settings key.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add QualityGateConfig type"
```

### Task 4: Implement quality gates runner

**Files:**
- Create: `src-tauri/src/loop_engine/quality_gates.rs`

- [ ] **Step 1: Implement gate runner**

```rust
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct GateResult {
    pub name: String,
    pub passed: bool,
    pub output: String,
}

/// Run all configured quality gates sequentially
pub async fn run_quality_gates(
    config: &QualityGateConfig,
    project_path: &str,
) -> Vec<GateResult> {
    let mut results = Vec::new();

    if let Some(cmd) = &config.build_command {
        results.push(run_gate("build", cmd, project_path).await);
    }
    if let Some(cmd) = &config.lint_command {
        results.push(run_gate("lint", cmd, project_path).await);
    }
    if let Some(cmd) = &config.typecheck_command {
        results.push(run_gate("typecheck", cmd, project_path).await);
    }
    if let Some(cmd) = &config.test_command {
        results.push(run_gate("test", cmd, project_path).await);
    }

    results
}

async fn run_gate(name: &str, command: &str, cwd: &str) -> GateResult {
    // Split command into program and args
    // Run via tokio::process::Command with cwd
    // Capture stdout+stderr, check exit code
    // Return GateResult { name, passed: exit_code == 0, output }
}

pub fn all_gates_passed(results: &[GateResult]) -> bool {
    results.iter().all(|r| r.passed)
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/loop_engine/quality_gates.rs
git commit -m "feat: implement quality gates runner"
```

### Task 5: Implement circuit breaker

**Files:**
- Create: `src-tauri/src/loop_engine/circuit_breaker.rs`

- [ ] **Step 1: Implement circuit breaker checks**

```rust
use crate::state::{TrustLevel, ArbiterStateRow, Story};

pub enum CircuitBreakerAction {
    Continue,
    Pause(String),  // reason
    Stop(String),   // reason
}

pub fn check_circuit_breakers(
    arbiter_state: &ArbiterStateRow,
    current_story: &Story,
    consecutive_no_commit: i32,
) -> CircuitBreakerAction {
    let max_retries = match arbiter_state.trust_level {
        TrustLevel::Autonomous => 3,
        TrustLevel::FullAuto => 5,
        _ => 1,  // Supervised doesn't auto-retry
    };

    // Story retry limit
    if current_story.iteration_attempts >= max_retries {
        return CircuitBreakerAction::Pause(
            format!("Story '{}' failed {} times", current_story.title, current_story.iteration_attempts)
        );
    }

    // No commit detection
    if consecutive_no_commit >= 3 {
        return CircuitBreakerAction::Pause(
            "No commit in 3 consecutive iterations".to_string()
        );
    }

    // Max iterations
    if arbiter_state.iteration_count >= arbiter_state.max_iterations {
        return CircuitBreakerAction::Stop(
            format!("Max iterations ({}) reached", arbiter_state.max_iterations)
        );
    }

    CircuitBreakerAction::Continue
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/loop_engine/circuit_breaker.rs
git commit -m "feat: implement circuit breaker logic"
```

---

## Chunk 3: Loop Engine Core

### Task 6: Implement the main loop engine

**Files:**
- Create: `src-tauri/src/loop_engine/engine.rs`

- [ ] **Step 1: Define loop engine events and state**

```rust
use tokio::sync::mpsc;

pub enum LoopCommand {
    Start { project_id: String, project_path: String, user_request: Option<String> },
    Pause,
    Resume,
    Cancel,
    Intervene { session_id: String },  // user takes over a session
    HandBack { session_id: String },    // user gives session back to loop
}

pub enum LoopEvent {
    StatusChanged { status: String },
    StoryStarted { story_id: String },
    StoryCompleted { story_id: String },
    StoryFailed { story_id: String, reason: String },
    IterationCompleted { count: i32, max: i32 },
    GateResult { story_id: String, gate: String, passed: bool, output: String },
    CircuitBreakerTriggered { reason: String },
    LoopCompleted,
    LoopFailed { reason: String },
    ReasoningEntry { action: String, reasoning: String },
}
```

- [ ] **Step 2: Implement the main loop**

```rust
pub async fn run_loop(
    db: DbPool,
    pty_manager: Arc<RwLock<PtyManager>>,
    app_handle: tauri::AppHandle,
    mut cmd_rx: mpsc::Receiver<LoopCommand>,
    event_tx: mpsc::Sender<LoopEvent>,
    memory_worker_tx: mpsc::Sender<MemoryWorkerEvent>,
) {
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            LoopCommand::Start { project_id, project_path, user_request } => {
                run_loop_lifecycle(
                    &db, &pty_manager, &app_handle,
                    &mut cmd_rx, &event_tx, &memory_worker_tx,
                    &project_id, &project_path, user_request.as_deref(),
                ).await;
            }
            _ => {} // Other commands ignored when not running
        }
    }
}

async fn run_loop_lifecycle(
    db: &DbPool,
    pty_manager: &Arc<RwLock<PtyManager>>,
    app_handle: &tauri::AppHandle,
    cmd_rx: &mut mpsc::Receiver<LoopCommand>,
    event_tx: &mpsc::Sender<LoopEvent>,
    memory_worker_tx: &mpsc::Sender<MemoryWorkerEvent>,
    project_id: &str,
    project_path: &str,
    user_request: Option<&str>,
) {
    // 1. If user_request provided, decompose into stories
    //    - Call Arbiter::DecomposeRequest
    //    - Create stories in DB
    //    - Set loop_status = "planning" then "running"

    // 2. Main iteration loop
    loop {
        // Check for pause/cancel commands (non-blocking)
        if let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                LoopCommand::Pause => { /* set status paused, wait for resume */ }
                LoopCommand::Cancel => { /* set status idle, break */ }
                _ => {}
            }
        }

        // Get next story via Arbiter::SelectNextStory
        // If no next story, check if all complete
        // If all complete, break with success

        // Check circuit breakers
        // If triggered, pause/stop and break

        // Assemble context prompt for the story
        // - Load relevant context_units (L1 level)
        // - Load relevant memories
        // - Include story description + acceptance criteria
        // - Include failure context if retry

        // Spawn fresh agent session
        // - Use PromptDelivery to inject prompt
        // - Monitor for completion/needs_input

        // Wait for agent completion
        // - Listen for pty-exit or finished pattern
        // - Handle needs_input via Arbiter::AnswerQuestion

        // Run quality gates
        // - If all pass + Arbiter::JudgeCompletion passes
        //   -> mark story complete, extract memories
        // - If fail
        //   -> increment attempts, record failure, continue to next iteration

        // Increment iteration count, update last_activity
    }
}
```

This is the highest-complexity function. Key implementation details:
- Use `tokio::select!` to listen for both PTY events and loop commands simultaneously
- Agent completion detected via Tauri events (`pty-exit-{id}`) or output monitoring
- For InteractiveInput agents, monitor the output for `detect_finished_pattern`
- Quality gates run as subprocess commands after the agent finishes

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/loop_engine/engine.rs
git commit -m "feat: implement main loop engine state machine"
```

### Task 7: Implement orchestrator for multi-agent loops

**Files:**
- Create: `src-tauri/src/loop_engine/orchestrator.rs`

- [ ] **Step 1: Implement dependency graph analysis**

```rust
/// Analyze stories and determine execution strategy
pub fn plan_execution(stories: &[Story]) -> Vec<ExecutionGroup> {
    // Build dependency graph
    // Topological sort
    // Group independent stories into parallel groups
    // Return ordered groups
}

pub struct ExecutionGroup {
    pub story_ids: Vec<String>,
    pub pattern: ExecutionPattern,
}

pub enum ExecutionPattern {
    Sequential,  // one at a time (has dependencies)
    Parallel,    // can run simultaneously
}
```

- [ ] **Step 2: Implement parallel execution in engine**

Extend the loop engine to handle `ExecutionPattern::Parallel`:
- Spawn multiple agent sessions (up to concurrent limit from settings)
- Monitor all simultaneously
- When one completes, extract memories (public visibility for cross-agent)
- Other agents get new memories at their next iteration boundary

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/loop_engine/orchestrator.rs src-tauri/src/loop_engine/engine.rs
git commit -m "feat: implement multi-agent orchestration with parallel execution"
```

---

## Chunk 4: Loop Engine IPC & Frontend

### Task 8: Create loop Tauri commands

**Files:**
- Create: `src-tauri/src/commands/loop_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create loop_commands.rs**

```rust
#[tauri::command]
pub async fn start_loop(
    state: ...,
    project_id: String,
    project_path: String,
    user_request: Option<String>,
) -> Result<(), String> {
    // Send LoopCommand::Start to the loop engine channel
}

#[tauri::command]
pub async fn pause_loop(state: ...) -> Result<(), String>

#[tauri::command]
pub async fn resume_loop(state: ...) -> Result<(), String>

#[tauri::command]
pub async fn cancel_loop(state: ...) -> Result<(), String>

#[tauri::command]
pub async fn get_loop_state(state: ..., project_id: String) -> Result<LoopStateDto, String> {
    // Return current arbiter_state + stories + gate results
}

#[tauri::command]
pub async fn set_quality_gates(
    state: ...,
    project_id: String,
    config: QualityGateConfig,
) -> Result<(), String>

#[tauri::command]
pub async fn get_quality_gates(
    state: ...,
    project_id: String,
) -> Result<QualityGateConfig, String>

#[tauri::command]
pub async fn set_max_iterations(
    state: ...,
    project_id: String,
    max: i32,
) -> Result<(), String>
```

- [ ] **Step 2: Start loop engine worker in lib.rs**

```rust
let (loop_cmd_tx, loop_cmd_rx) = tokio::sync::mpsc::channel(16);
let (loop_event_tx, mut loop_event_rx) = tokio::sync::mpsc::channel(64);

tokio::spawn(loop_engine::engine::run_loop(
    db.clone(),
    pty_manager.clone(),
    app_handle.clone(),
    loop_cmd_rx,
    loop_event_tx,
    memory_tx.clone(),
));

// Forward loop events to frontend via Tauri events
tokio::spawn(async move {
    while let Some(event) = loop_event_rx.recv().await {
        app_handle_clone.emit("loop-event", &event).ok();
    }
});
```

Add `loop_cmd_tx: tokio::sync::mpsc::Sender<LoopCommand>` to AppState.

- [ ] **Step 3: Register commands**

Add `pub mod loop_commands;` to `commands/mod.rs`.
Add all new commands to `generate_handler!` in `lib.rs`.
Add `mod loop_engine;` to module declarations.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/loop_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/state.rs
git commit -m "feat: add Loop Engine Tauri commands and event forwarding"
```

### Task 9: Add TypeScript types and IPC

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add loop types**

```typescript
export interface QualityGateConfig {
  build_command: string | null;
  lint_command: string | null;
  typecheck_command: string | null;
  test_command: string | null;
  arbiter_judge: boolean;
}

export interface GateResult {
  name: string;
  passed: boolean;
  output: string;
}

export type LoopEventType =
  | { type: "StatusChanged"; status: LoopStatus }
  | { type: "StoryStarted"; story_id: string }
  | { type: "StoryCompleted"; story_id: string }
  | { type: "StoryFailed"; story_id: string; reason: string }
  | { type: "IterationCompleted"; count: number; max: number }
  | { type: "GateResult"; story_id: string; gate: string; passed: boolean; output: string }
  | { type: "CircuitBreakerTriggered"; reason: string }
  | { type: "LoopCompleted" }
  | { type: "LoopFailed"; reason: string }
  | { type: "ReasoningEntry"; action: string; reasoning: string };
```

- [ ] **Step 2: Add loop IPC functions**

```typescript
export async function startLoop(projectId: string, projectPath: string, userRequest?: string): Promise<void>
export async function pauseLoop(): Promise<void>
export async function resumeLoop(): Promise<void>
export async function cancelLoop(): Promise<void>
export async function getLoopState(projectId: string): Promise<{ arbiter_state: ArbiterState; stories: Story[] }>
export async function setQualityGates(projectId: string, config: QualityGateConfig): Promise<void>
export async function getQualityGates(projectId: string): Promise<QualityGateConfig>
export async function setMaxIterations(projectId: string, max: number): Promise<void>
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/tauri.ts
git commit -m "feat: add Loop Engine TypeScript types and IPC functions"
```

### Task 10: Create loop Zustand store

**Files:**
- Create: `src/stores/loopStore.ts`

- [ ] **Step 1: Implement loop store**

```typescript
interface LoopState {
  status: LoopStatus;
  stories: Story[];
  gateResults: Record<string, GateResult[]>;  // keyed by story_id
  reasoningLog: { action: string; reasoning: string; timestamp: string }[];
  iterationCount: number;
  maxIterations: number;

  loadState: (projectId: string) => Promise<void>;
  startLoop: (projectId: string, projectPath: string, request?: string) => Promise<void>;
  pauseLoop: () => Promise<void>;
  resumeLoop: () => Promise<void>;
  cancelLoop: () => Promise<void>;
}
```

Subscribe to `loop-event` Tauri events and update store state reactively.

- [ ] **Step 2: Commit**

```bash
git add src/stores/loopStore.ts
git commit -m "feat: add Loop Engine Zustand store with event subscription"
```

### Task 11: Build Loop panel UI

**Files:**
- Create: `src/features/loop/components/LoopPanel.tsx`
- Create: `src/features/loop/components/StoryList.tsx`
- Create: `src/features/loop/components/StoryEditor.tsx`
- Create: `src/features/loop/components/LoopControls.tsx`
- Create: `src/features/loop/components/LoopProgress.tsx`
- Create: `src/features/loop/components/ArbiterReasoningLog.tsx`

- [ ] **Step 1: Build StoryList**

Displays stories with:
- Status indicator per story (pending=gray, in_progress=blue, completed=green, failed=red, skipped=dim)
- Story title and description preview
- Acceptance criteria (expandable)
- Iteration attempts counter
- Dependencies visualization (which stories it depends on)
- Drag to reorder (when paused)
- Click to view details

- [ ] **Step 2: Build StoryEditor**

Modal for adding/editing a story:
- Title, description, acceptance criteria fields
- Priority slider
- Dependencies multi-select (from other stories)
- Delete button

- [ ] **Step 3: Build LoopControls**

Control bar:
- "Start Loop" button (opens input for user request, or "Start from existing stories")
- Pause / Resume button (toggles based on status)
- Cancel button
- "Edit Plan" button (pauses and opens story editor)

- [ ] **Step 4: Build LoopProgress**

Status display:
- Current iteration / max iterations progress bar
- Current story name
- Circuit breaker status indicators
- Time since last activity

- [ ] **Step 5: Build ArbiterReasoningLog**

Scrollable log of Arbiter decisions:
- Each entry: action type, reasoning text, timestamp
- Filterable by action type

- [ ] **Step 6: Build LoopPanel**

Main panel composing all sub-components:
- LoopControls at top
- LoopProgress below controls
- Two-column layout: StoryList (left), ArbiterReasoningLog (right)
- Quality gate configuration (expandable settings section)

- [ ] **Step 7: Add Loop panel to layout**

Add a new panel tab/section. The Loop panel is visible per project when Arbiter is enabled.

- [ ] **Step 8: Commit**

```bash
git add src/features/loop/
git commit -m "feat: build Loop Engine UI with stories, controls, and reasoning log"
```

### Task 12: Quality gates configuration UI

**Files:**
- Modify: `src/features/loop/components/LoopPanel.tsx` (or separate component)

- [ ] **Step 1: Add quality gate settings section**

Expandable section in LoopPanel:
- Build command input (e.g., `npm run build`)
- Lint command input
- Typecheck command input
- Test command input
- "Enable Arbiter judge" toggle
- "Save" button

Calls `setQualityGates` IPC on save.

- [ ] **Step 2: Commit**

```bash
git add src/features/loop/
git commit -m "feat: add quality gates configuration UI"
```

### Task 13: Build verification

- [ ] **Step 1: Verify Rust builds**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 2: Verify TypeScript builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Builds without errors

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues in Loop Engine implementation"
```

---

## Chunk 5: Promptfoo Integration (Optional, Dev-time)

### Task 14: Set up promptfoo for Arbiter testing

**Files:**
- Create: `promptfoo.yaml`
- Create: `tests/arbiter/` directory with test cases

- [ ] **Step 1: Install promptfoo as dev dependency**

Run: `npm install -D promptfoo`

- [ ] **Step 2: Create promptfoo.yaml**

```yaml
prompts:
  - file://tests/arbiter/answer_question.txt
  - file://tests/arbiter/decompose_request.txt
  - file://tests/arbiter/judge_completion.txt

providers:
  - id: claude
    config:
      model: claude-sonnet-4-20250514

tests:
  - description: "Answer simple yes/no question"
    vars:
      terminal_output: "Do you want to proceed? (y/n)"
      options: "y, n"
    assert:
      - type: contains
        value: "ANSWER:"

  - description: "Decompose a web app request"
    vars:
      user_request: "Build a todo app with React and Express"
    assert:
      - type: contains
        value: "STORY:"
      - type: javascript
        value: "output.split('STORY:').length >= 3"
```

- [ ] **Step 3: Commit**

```bash
git add promptfoo.yaml tests/arbiter/
git commit -m "chore: add promptfoo config for Arbiter prompt regression testing"
```

---

## Verification Checklist

- [ ] PromptDelivery is set on all agent definitions
- [ ] Loop can be started with a natural language request
- [ ] Arbiter decomposes request into stories
- [ ] Stories display in the UI with correct status
- [ ] Loop iterates through stories, spawning fresh agent sessions
- [ ] InteractiveInput delivery writes prompt to PTY after agent is idle
- [ ] PositionalArg delivery passes prompt as CLI arg at spawn
- [ ] Quality gates run after each iteration
- [ ] Circuit breakers trigger correctly (max retries, no commit, max iterations)
- [ ] Loop can be paused, resumed, and cancelled
- [ ] Stories can be edited while loop is paused
- [ ] Multi-agent parallel execution works for independent stories
- [ ] Cross-agent memory sharing via public memories works at iteration boundaries
- [ ] Arbiter reasoning log shows decision history
- [ ] Loop state persists across app restart (crash recovery)
- [ ] `cargo build` and `npm run build` both succeed
