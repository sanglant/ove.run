# Copilot CLI & Codex CLI Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GitHub Copilot CLI and OpenAI Codex CLI as supported agent types alongside the existing Claude and Gemini agents.

**Architecture:** The system already has a clean extension point — add new variants to the `AgentType` enum in Rust and TypeScript, register `AgentDefinition` entries in the Rust registry, and add output-detection pattern entries in the TypeScript patterns file. No changes needed to PTY, terminal UI, session management, or any other subsystem.

**Tech Stack:** Rust (Tauri backend, `src-tauri/`), TypeScript/React (frontend, `src/`)

---

### Task 1: Extend the Rust `AgentType` enum

**Files:**
- Modify: `src-tauri/src/state.rs:28-31`

No test framework exists for the Rust side; the Tauri build acts as the integration test.

**Step 1: Add two new variants to the enum**

In `src-tauri/src/state.rs`, change:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    Claude,
    Gemini,
}
```
to:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    Claude,
    Gemini,
    Copilot,
    Codex,
}
```

**Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1
```
Expected: `warning` about unused variants is fine; `error` is not.

**Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add Copilot and Codex variants to AgentType enum"
```

---

### Task 2: Register agent definitions in the Rust registry

**Files:**
- Modify: `src-tauri/src/agents/registry.rs`

**Step 1: Add Copilot and Codex definitions**

In `src-tauri/src/agents/registry.rs`, extend the `vec![]` in `get_agent_definitions()` to add two new entries after the Gemini entry:

```rust
AgentDefinition {
    agent_type: AgentType::Copilot,
    display_name: "GitHub Copilot".to_string(),
    command: "copilot".to_string(),
    default_args: vec![],
    yolo_flag: "--yolo".to_string(),
    // Copilot shows a prompt when idle
    detect_idle_pattern: r"(?i)(copilot>\s*$|>\s*$|\$\s*$)".to_string(),
    // Copilot asks for tool/action approval
    detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\]|approve|deny|allow)".to_string(),
    // Copilot signals task completion
    detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed|done\.)".to_string(),
    icon: "copilot".to_string(),
},
AgentDefinition {
    agent_type: AgentType::Codex,
    display_name: "Codex CLI".to_string(),
    command: "codex".to_string(),
    default_args: vec![],
    yolo_flag: "--full-auto".to_string(),
    // Codex shows a prompt when idle
    detect_idle_pattern: r"(?i)(codex>\s*$|>\s*$|\$\s*$)".to_string(),
    // Codex asks for action approval before executing
    detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\]|approve|deny|apply changes)".to_string(),
    // Codex signals task completion
    detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed|done\.)".to_string(),
    icon: "codex".to_string(),
},
```

**Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1
```
Expected: clean or warnings only.

**Step 3: Commit**

```bash
git add src-tauri/src/agents/registry.rs
git commit -m "feat: register Copilot CLI and Codex CLI agent definitions"
```

---

### Task 3: Extend the TypeScript `AgentType` union

**Files:**
- Modify: `src/types/index.ts:1`

**Step 1: Update the union type**

In `src/types/index.ts`, change line 1:
```typescript
export type AgentType = "claude" | "gemini";
```
to:
```typescript
export type AgentType = "claude" | "gemini" | "copilot" | "codex";
```

**Step 2: Check for TypeScript errors**

```bash
cd /home/szymon-grzybek/Projects/agentic && npx tsc --noEmit 2>&1
```
Expected: no new errors introduced by this change (the new values are additive).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add copilot and codex to AgentType union type"
```

---

### Task 4: Add output-detection patterns for Copilot and Codex

**Files:**
- Modify: `src/lib/patterns.ts`

**Step 1: Add pattern entries to `AGENT_PATTERNS`**

In `src/lib/patterns.ts`, the `AGENT_PATTERNS` object is typed as `Record<AgentType, PatternEntry[]>`. After adding the new `AgentType` values TypeScript will now require entries for `"copilot"` and `"codex"`. Add them after the `gemini` entry:

```typescript
  copilot: [
    // needs_input — Copilot tool/action approval prompts
    {
      pattern: /\(y\/n\)/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /\[Y\/n\]|\[y\/N\]/,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Allow|Deny|Approve|approve|deny/i,
      status: "needs_input",
      label: "Waiting for permission",
    },
    {
      pattern: /Do you want to proceed|Do you want to continue/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Press Enter/i,
      status: "needs_input",
      label: "Waiting for enter",
    },
    // working
    {
      pattern: /Planning\.\.\.|Thinking\.\.\.|Generating\.\.\./i,
      status: "working",
      label: "Planning",
    },
    {
      pattern: /Executing|Running tool|Calling tool/i,
      status: "working",
      label: "Executing",
    },
    {
      pattern: /Reading|Writing|Editing|Searching/i,
      status: "working",
      label: "Working",
    },
    // error
    {
      pattern: /Error:|ERROR:|error:|FATAL/,
      status: "error",
      label: "Error",
    },
    // finished
    {
      pattern: /Task complete|TASK COMPLETE|Done\.|Finished\./i,
      status: "finished",
      label: "Task complete",
    },
    // idle
    {
      pattern: /copilot>\s*$/i,
      status: "idle",
      label: "Idle",
    },
    {
      pattern: />\s*$/,
      status: "idle",
      label: "Idle",
    },
  ],
  codex: [
    // needs_input — Codex action approval prompts
    {
      pattern: /\(y\/n\)/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /\[Y\/n\]|\[y\/N\]/,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Apply changes\?|apply changes/i,
      status: "needs_input",
      label: "Waiting for approval",
    },
    {
      pattern: /Allow|Deny|approve|deny/i,
      status: "needs_input",
      label: "Waiting for permission",
    },
    {
      pattern: /Press Enter/i,
      status: "needs_input",
      label: "Waiting for enter",
    },
    // working
    {
      pattern: /Thinking\.\.\.|Planning\.\.\.|Generating\.\.\./i,
      status: "working",
      label: "Thinking",
    },
    {
      pattern: /Running|Executing|Applying/i,
      status: "working",
      label: "Executing",
    },
    {
      pattern: /Reading|Writing|Editing|Searching/i,
      status: "working",
      label: "Working",
    },
    // error
    {
      pattern: /Error:|ERROR:|error:|FATAL/,
      status: "error",
      label: "Error",
    },
    // finished
    {
      pattern: /Task complete|TASK COMPLETE|Done\.|Finished\./i,
      status: "finished",
      label: "Task complete",
    },
    // idle
    {
      pattern: /codex>\s*$/i,
      status: "idle",
      label: "Idle",
    },
    {
      pattern: />\s*$/,
      status: "idle",
      label: "Idle",
    },
  ],
```

**Step 2: Check TypeScript**

```bash
cd /home/szymon-grzybek/Projects/agentic && npx tsc --noEmit 2>&1
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/patterns.ts
git commit -m "feat: add output detection patterns for Copilot CLI and Codex CLI"
```

---

### Task 5: Verify full build

**Step 1: Run the frontend build**

```bash
cd /home/szymon-grzybek/Projects/agentic && npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors.

**Step 2: Run the Tauri dev build check**

```bash
cd /home/szymon-grzybek/Projects/agentic/src-tauri && cargo check 2>&1
```
Expected: clean or warnings only.

**Step 3: Commit if anything was missed**

Only if there are uncommitted fixups:
```bash
git add -p
git commit -m "fix: resolve build issues for Copilot/Codex CLI support"
```
