# Plan 4: Expanded Arbiter — Trust Levels, Actions & State Machine

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Arbiter from a reactive question-answerer into a state machine with 7 action types, adjustable trust levels per project, and the intelligence layer that the Loop Engine (Plan 5) will drive.

**Architecture:** Rust state machine with distinct `ArbiterAction` variants, each with its own prompt template. Trust levels stored in `arbiter_state` table. All LLM calls go through the existing `arbiter_review` CLI path. The Arbiter becomes the central brain that context store and memory feed into.

**Tech Stack:** Rust (rusqlite, tokio, serde_json), TypeScript/React (Mantine), Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-13-arbiter-extensions-design.md` — Section 4

---

**What Plan 1 built:**
- SQLite database with `arbiter_state` table (trust_level, loop_status, current_story_id, etc.)
- `arbiter_review` Tauri command for CLI-based LLM calls
- Renamed guardian -> arbiter everywhere

**What Plan 2 built:**
- Context Store with full CRUD, FTS5 search, L0/L1/L2 tiered loading
- `list_l0_summaries()` for Arbiter to scan relevant context
- `generate_context_summary()` for L0/L1 generation
- Context assignment system (session + project defaults)

**What Plan 3 built:**
- Memory system with extraction, FTS5 search, scored retrieval
- `search_memories()` with importance * recency scoring
- Background consolidation worker
- Memory integrated into Arbiter's AnswerQuestion flow

**What this plan builds:**
- `db/arbiter_state.rs` — full arbiter state CRUD
- Trust level selection UI (shown when enabling Arbiter per project)
- 7 Arbiter action types with prompt templates
- Arbiter state machine (ArbiterAction enum + dispatch)
- Enhanced AnswerQuestion that loads context + memories
- DecomposeRequest action (user request -> stories)
- SelectNextStory action (plan + memory -> next task)
- JudgeCompletion action (test output + criteria -> pass/fail)
- Arbiter settings panel updates (trust level display/change)

**What the next plan needs:**
- `ArbiterAction::DecomposeRequest` creates stories in the `stories` table
- `ArbiterAction::SelectNextStory` reads stories and returns next story ID
- `ArbiterAction::JudgeCompletion` evaluates test output against acceptance criteria
- `arbiter_state` table tracks loop_status, current_story_id, iteration_count
- Trust level determines which actions run automatically vs. require user approval

---

## File Structure

### New Files
- `src-tauri/src/arbiter/mod.rs` — arbiter module
- `src-tauri/src/arbiter/actions.rs` — ArbiterAction enum, prompt templates, response parsing
- `src-tauri/src/arbiter/dispatch.rs` — dispatch function that routes actions to CLI calls
- `src-tauri/src/arbiter/prompts.rs` — all prompt templates as constants
- `src-tauri/src/commands/arbiter_commands.rs` — Tauri IPC commands for arbiter operations
- `src/features/arbiter/components/TrustLevelSelector.tsx` — trust level selection UI
- `src/features/arbiter/components/ArbiterStatusPanel.tsx` — arbiter state display

### Modified Files
- `src-tauri/src/db/arbiter_state.rs` — implement full CRUD (currently a stub)
- `src-tauri/src/db/stories.rs` — implement story CRUD (currently a stub, needed for DecomposeRequest)
- `src-tauri/src/state.rs` — add ArbiterAction, TrustLevel enums, Story struct
- `src-tauri/src/commands/mod.rs` — add arbiter_commands
- `src-tauri/src/commands/project_commands.rs` — update arbiter_review to use new dispatch
- `src-tauri/src/lib.rs` — register new commands, add arbiter module
- `src/types/index.ts` — add TrustLevel, ArbiterState, Story types
- `src/lib/tauri.ts` — add arbiter IPC functions
- `src/lib/arbiter.ts` — refactor to use new action-based system
- `src/stores/arbiterStore.ts` — expand with trust level and state tracking
- `src/features/settings/components/SettingsModal.tsx` — add trust level controls
- `src/features/arbiter/components/AgentFeedbackModal.tsx` — update to use enhanced answering

---

## Chunk 1: Arbiter State & Types

### Task 1: Add Arbiter types to Rust

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add TrustLevel and ArbiterState types**

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[repr(u8)]
pub enum TrustLevel {
    Supervised = 1,
    Autonomous = 2,
    FullAuto = 3,
}

impl TrustLevel {
    pub fn from_i32(v: i32) -> Self {
        match v {
            1 => TrustLevel::Supervised,
            3 => TrustLevel::FullAuto,
            _ => TrustLevel::Autonomous,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbiterStateRow {
    pub project_id: String,
    pub trust_level: TrustLevel,
    pub loop_status: String,        // idle, planning, running, paused, completed, failed
    pub current_story_id: Option<String>,
    pub iteration_count: i32,
    pub max_iterations: i32,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: Option<String>,
    pub priority: i32,
    pub status: String,             // pending, in_progress, completed, failed, skipped
    pub depends_on_json: String,
    pub iteration_attempts: i32,
    pub created_at: String,
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add TrustLevel, ArbiterStateRow, and Story types"
```

### Task 2: Implement arbiter_state CRUD

**Files:**
- Modify: `src-tauri/src/db/arbiter_state.rs`

- [ ] **Step 1: Implement CRUD**

```rust
pub fn get_arbiter_state(conn: &Connection, project_id: &str) -> Result<Option<ArbiterStateRow>, rusqlite::Error>
pub fn upsert_arbiter_state(conn: &Connection, state: &ArbiterStateRow) -> Result<(), rusqlite::Error>
pub fn set_trust_level(conn: &Connection, project_id: &str, level: TrustLevel) -> Result<(), rusqlite::Error>
pub fn set_loop_status(conn: &Connection, project_id: &str, status: &str) -> Result<(), rusqlite::Error>
pub fn set_current_story(conn: &Connection, project_id: &str, story_id: Option<&str>) -> Result<(), rusqlite::Error>
pub fn increment_iteration(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error>
pub fn reset_loop(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error>
pub fn update_last_activity(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error>
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/arbiter_state.rs
git commit -m "feat: implement arbiter_state CRUD operations"
```

### Task 3: Implement stories CRUD

**Files:**
- Modify: `src-tauri/src/db/stories.rs`

- [ ] **Step 1: Implement CRUD**

```rust
pub fn create_story(conn: &Connection, story: &Story) -> Result<(), rusqlite::Error>
pub fn create_stories_batch(conn: &Connection, stories: &[Story]) -> Result<(), rusqlite::Error>
pub fn list_stories(conn: &Connection, project_id: &str) -> Result<Vec<Story>, rusqlite::Error>
pub fn get_story(conn: &Connection, id: &str) -> Result<Story, rusqlite::Error>
pub fn update_story_status(conn: &Connection, id: &str, status: &str) -> Result<(), rusqlite::Error>
pub fn increment_story_attempts(conn: &Connection, id: &str) -> Result<(), rusqlite::Error>
pub fn update_story(conn: &Connection, story: &Story) -> Result<(), rusqlite::Error>
pub fn delete_story(conn: &Connection, id: &str) -> Result<(), rusqlite::Error>
pub fn delete_project_stories(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error>

/// Get next story to work on: pending, not blocked by incomplete dependencies, highest priority
pub fn get_next_story(conn: &Connection, project_id: &str) -> Result<Option<Story>, rusqlite::Error> {
    // SELECT stories WHERE project_id=? AND status='pending'
    // Filter: all depends_on story IDs have status='completed'
    // ORDER BY priority DESC
    // LIMIT 1
}

/// Check if all stories for a project are completed
pub fn all_stories_complete(conn: &Connection, project_id: &str) -> Result<bool, rusqlite::Error>
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/stories.rs
git commit -m "feat: implement stories CRUD with dependency-aware next-story selection"
```

---

## Chunk 2: Arbiter Action System

### Task 4: Create Arbiter action types and prompt templates

**Files:**
- Create: `src-tauri/src/arbiter/mod.rs`
- Create: `src-tauri/src/arbiter/actions.rs`
- Create: `src-tauri/src/arbiter/prompts.rs`

- [ ] **Step 1: Create arbiter module**

`src-tauri/src/arbiter/mod.rs`:
```rust
pub mod actions;
pub mod dispatch;
pub mod prompts;
```

- [ ] **Step 2: Define ArbiterAction enum**

`src-tauri/src/arbiter/actions.rs`:
```rust
use crate::state::{Memory, ContextUnit, Story};

#[derive(Debug)]
pub enum ArbiterAction {
    AnswerQuestion {
        terminal_output: String,
        options: Vec<String>,
        allow_free_input: bool,
        context_units: Vec<ContextUnit>,
        memories: Vec<Memory>,
    },
    DecomposeRequest {
        user_request: String,
        project_context: Vec<ContextUnit>,
        memories: Vec<Memory>,
    },
    SelectNextStory {
        stories: Vec<Story>,
        completed_stories: Vec<Story>,
        memories: Vec<Memory>,
    },
    JudgeCompletion {
        story: Story,
        test_output: String,
        gate_results: Vec<(String, bool, String)>,  // (gate_name, passed, output)
    },
    ExtractMemories {
        terminal_output: String,
    },
    ConsolidateMemory {
        memories: Vec<Memory>,
    },
    GenerateSummary {
        name: String,
        unit_type: String,
        l2_content: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArbiterResponse {
    pub answer: Option<String>,
    pub answer_text: Option<String>,
    pub reasoning: Option<String>,
    pub stories: Option<Vec<StoryDraft>>,
    pub next_story_id: Option<String>,
    pub passed: Option<bool>,
    pub memories: Option<Vec<MemoryDraft>>,
    pub summary: Option<String>,
    pub insight: Option<String>,
    pub l0_summary: Option<String>,
    pub l1_overview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoryDraft {
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
    pub priority: i32,
    pub depends_on: Vec<String>,  // story titles that must complete first
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryDraft {
    pub content: String,
    pub importance: f64,
    pub entities: Vec<String>,
    pub topics: Vec<String>,
    pub visibility: String,
}
```

- [ ] **Step 3: Define prompt templates**

`src-tauri/src/arbiter/prompts.rs`:

Define const string templates for each action type:
- `ANSWER_QUESTION_TEMPLATE` — enhanced version of current arbiter prompt with context + memory sections
- `DECOMPOSE_REQUEST_TEMPLATE` — takes user request, returns structured stories as JSON
- `SELECT_NEXT_STORY_TEMPLATE` — takes plan state, returns next story ID with reasoning
- `JUDGE_COMPLETION_TEMPLATE` — takes test output + criteria, returns PASSED/FAILED with reasoning
- `EXTRACT_MEMORIES_TEMPLATE` — takes terminal output, returns structured facts
- `CONSOLIDATE_MEMORY_TEMPLATE` — takes batch of memories, returns SUMMARY + INSIGHT
- `GENERATE_SUMMARY_TEMPLATE` — takes L2 content, returns L0_SUMMARY + L1_OVERVIEW

Each template uses `{placeholder}` syntax for variable insertion.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/arbiter/
git commit -m "feat: define Arbiter action types and prompt templates"
```

### Task 5: Create Arbiter dispatch function

**Files:**
- Create: `src-tauri/src/arbiter/dispatch.rs`

- [ ] **Step 1: Implement dispatch**

```rust
use crate::arbiter::actions::{ArbiterAction, ArbiterResponse};
use crate::arbiter::prompts;

/// Dispatch an arbiter action to CLI and parse the response
pub async fn dispatch(
    action: ArbiterAction,
    project_path: &str,
    cli_command: Option<&str>,
    model: Option<&str>,
) -> Result<ArbiterResponse, String> {
    let prompt = build_prompt(&action);
    let raw_response = crate::commands::project_commands::arbiter_review_internal(
        prompt, project_path.to_string(), cli_command.map(|s| s.to_string()), model.map(|s| s.to_string())
    ).await?;
    parse_response(&action, &raw_response)
}

fn build_prompt(action: &ArbiterAction) -> String {
    match action {
        ArbiterAction::AnswerQuestion { terminal_output, options, allow_free_input, context_units, memories } => {
            // Fill ANSWER_QUESTION_TEMPLATE with variables
        }
        ArbiterAction::DecomposeRequest { user_request, project_context, memories } => {
            // Fill DECOMPOSE_REQUEST_TEMPLATE
        }
        // ... other variants
    }
}

fn parse_response(action: &ArbiterAction, raw: &str) -> Result<ArbiterResponse, String> {
    match action {
        ArbiterAction::AnswerQuestion { .. } => {
            // Parse ANSWER:, ANSWER_TEXT:, REASONING: lines
        }
        ArbiterAction::DecomposeRequest { .. } => {
            // Parse JSON array of stories from response
        }
        ArbiterAction::SelectNextStory { .. } => {
            // Parse NEXT_STORY: and REASONING: lines
        }
        ArbiterAction::JudgeCompletion { .. } => {
            // Parse PASSED: true/false and REASONING:
        }
        ArbiterAction::ExtractMemories { .. } => {
            // Parse MEMORY: lines
        }
        ArbiterAction::ConsolidateMemory { .. } => {
            // Parse SUMMARY: and INSIGHT:
        }
        ArbiterAction::GenerateSummary { .. } => {
            // Parse L0_SUMMARY: and L1_OVERVIEW:
        }
    }
}
```

- [ ] **Step 2: Extract arbiter_review internals**

Refactor `arbiter_review` in `project_commands.rs` to expose an internal function that `dispatch` can call:
```rust
pub(crate) async fn arbiter_review_internal(
    prompt: String,
    project_path: String,
    cli_command: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    // Existing implementation (temp dir, CLI spawn, capture output)
}

#[tauri::command]
pub async fn arbiter_review(...) -> Result<String, String> {
    arbiter_review_internal(prompt, project_path, cli_command, model).await
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/arbiter/dispatch.rs src-tauri/src/commands/project_commands.rs
git commit -m "feat: implement Arbiter action dispatch with CLI integration"
```

### Task 6: Create Arbiter Tauri commands

**Files:**
- Create: `src-tauri/src/commands/arbiter_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create arbiter_commands.rs**

```rust
#[tauri::command]
pub async fn get_arbiter_state(state: ..., project_id: String) -> Result<Option<ArbiterStateRow>, String>

#[tauri::command]
pub async fn set_trust_level(state: ..., project_id: String, level: i32) -> Result<(), String>

#[tauri::command]
pub async fn decompose_request(
    state: ...,
    project_id: String,
    project_path: String,
    user_request: String,
) -> Result<Vec<Story>, String> {
    // 1. Load project context (L0 summaries) and relevant memories
    // 2. Build DecomposeRequest action
    // 3. Dispatch to Arbiter CLI
    // 4. Parse response into StoryDraft list
    // 5. Create Story entries in DB
    // 6. Update arbiter_state (loop_status = 'planning')
    // 7. Return created stories
}

#[tauri::command]
pub async fn list_stories(state: ..., project_id: String) -> Result<Vec<Story>, String>

#[tauri::command]
pub async fn update_story(state: ..., story: Story) -> Result<(), String>

#[tauri::command]
pub async fn delete_story(state: ..., id: String) -> Result<(), String>

#[tauri::command]
pub async fn reorder_stories(state: ..., project_id: String, story_ids: Vec<String>) -> Result<(), String>
```

- [ ] **Step 2: Register commands**

Add `pub mod arbiter_commands;` to `commands/mod.rs`.
Add all new commands to `generate_handler!` in `lib.rs`.
Add `mod arbiter;` to module declarations in `lib.rs`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/arbiter_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add Arbiter Tauri commands for state, trust, and decomposition"
```

---

## Chunk 3: Frontend — Trust Levels & Arbiter UI

### Task 7: Add TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add arbiter types**

```typescript
export type TrustLevel = 1 | 2 | 3;
export type LoopStatus = "idle" | "planning" | "running" | "paused" | "completed" | "failed";
export type StoryStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface ArbiterState {
  project_id: string;
  trust_level: TrustLevel;
  loop_status: LoopStatus;
  current_story_id: string | null;
  iteration_count: number;
  max_iterations: number;
  last_activity_at: string | null;
}

export interface Story {
  id: string;
  project_id: string;
  title: string;
  description: string;
  acceptance_criteria: string | null;
  priority: number;
  status: StoryStatus;
  depends_on_json: string;
  iteration_attempts: number;
  created_at: string;
}

export const TRUST_LEVEL_LABELS: Record<TrustLevel, { name: string; description: string }> = {
  1: { name: "Supervised", description: "I'll approve each step" },
  2: { name: "Autonomous", description: "Run it, ask me when stuck" },
  3: { name: "Full Auto", description: "Handle everything" },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TrustLevel, ArbiterState, and Story TypeScript types"
```

### Task 8: Add Arbiter IPC functions

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add arbiter IPC**

```typescript
export async function getArbiterState(projectId: string): Promise<ArbiterState | null>
export async function setTrustLevel(projectId: string, level: TrustLevel): Promise<void>
export async function decomposeRequest(projectId: string, projectPath: string, userRequest: string): Promise<Story[]>
export async function listStories(projectId: string): Promise<Story[]>
export async function updateStory(story: Story): Promise<void>
export async function deleteStory(id: string): Promise<void>
export async function reorderStories(projectId: string, storyIds: string[]): Promise<void>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add Arbiter and stories IPC functions"
```

### Task 9: Expand Arbiter Zustand store

**Files:**
- Modify: `src/stores/arbiterStore.ts`

- [ ] **Step 1: Expand store with trust level and state**

```typescript
interface ArbiterStoreState {
  arbiterState: Record<string, ArbiterState>;  // keyed by projectId
  stories: Record<string, Story[]>;             // keyed by projectId
  loadArbiterState: (projectId: string) => Promise<void>;
  setTrustLevel: (projectId: string, level: TrustLevel) => Promise<void>;
  loadStories: (projectId: string) => Promise<void>;
  decomposeRequest: (projectId: string, projectPath: string, request: string) => Promise<void>;
}
```

Remove the old `arbiterInitialized` tracking (replaced by arbiter_state).

- [ ] **Step 2: Commit**

```bash
git add src/stores/arbiterStore.ts
git commit -m "feat: expand Arbiter store with trust level and state tracking"
```

### Task 10: Build TrustLevelSelector component

**Files:**
- Create: `src/features/arbiter/components/TrustLevelSelector.tsx`

- [ ] **Step 1: Build selector**

A modal or inline selector shown when user toggles Arbiter on for a project:
- Three options with radio buttons or cards:
  - Supervised (icon: eye) — "I'll approve each step"
  - Autonomous (icon: robot, selected by default) — "Run it, ask me when stuck"
  - Full Auto (icon: rocket) — "Handle everything"
- Confirm button
- Changes can be made later in project settings

- [ ] **Step 2: Integrate with project settings**

When `arbiter_enabled` is toggled on, show the TrustLevelSelector. On selection, call `setTrustLevel` and create/update the `arbiter_state` row.

- [ ] **Step 3: Commit**

```bash
git add src/features/arbiter/components/TrustLevelSelector.tsx
git commit -m "feat: build trust level selector shown on Arbiter enable"
```

### Task 11: Build ArbiterStatusPanel

**Files:**
- Create: `src/features/arbiter/components/ArbiterStatusPanel.tsx`

- [ ] **Step 1: Build status panel**

Displays current Arbiter state for a project:
- Trust level badge with change button
- Loop status indicator (idle/planning/running/paused/completed/failed)
- Current story (if loop is running)
- Iteration count / max
- Last activity timestamp

This panel sits in the project view, visible when Arbiter is enabled.

- [ ] **Step 2: Commit**

```bash
git add src/features/arbiter/components/ArbiterStatusPanel.tsx
git commit -m "feat: build Arbiter status panel component"
```

### Task 12: Refactor arbiter.ts to use action system

**Files:**
- Modify: `src/lib/arbiter.ts`

- [ ] **Step 1: Refactor arbiterAnswer to use enhanced prompt**

The existing `arbiterAnswer` function should now:
1. Load context units for the session (via `listSessionContext`)
2. Load relevant memories (via `searchMemories`)
3. Include both in the prompt sent to `arbiterReview`

The prompt assembly moves to the Rust side via the dispatch system, but the TypeScript side still orchestrates when to call it.

For now, enhance the existing flow to include context + memory sections in the prompt:
```typescript
// Load context
const sessionContext = await listSessionContext(sessionId);
const contextSection = sessionContext
  .filter(u => u.l1_overview)
  .map(u => `[${u.type}: ${u.name}] ${u.l1_overview}`)
  .join("\n");

// Load memories (already done in Plan 3)
// Include both in prompt
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/arbiter.ts
git commit -m "refactor: enhance Arbiter answer with context units and memory"
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
git commit -m "fix: resolve build issues in expanded Arbiter implementation"
```

---

## Verification Checklist

- [ ] Trust level selector appears when enabling Arbiter on a project
- [ ] Default trust level is Autonomous (2)
- [ ] Trust level persists in arbiter_state table
- [ ] Trust level can be changed in project settings
- [ ] `decomposeRequest` calls Arbiter CLI and creates stories in DB
- [ ] Stories can be listed, edited, reordered, deleted
- [ ] ArbiterStatusPanel shows current state
- [ ] Arbiter AnswerQuestion includes context units and memories in prompt
- [ ] All 7 Arbiter action types have prompt templates defined
- [ ] Dispatch function correctly routes actions and parses responses
- [ ] `cargo build` and `npm run build` both succeed
