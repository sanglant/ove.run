# Session Redesign: Sandbox, Arbiter Loop, Bundled Content

## Overview

Four changes unified under a single session-centric redesign:

1. Decouple sandbox from arbiter — make it an opt-in per-session toggle
2. Merge Loop into the terminal view with an artifacts pane
3. Redesign the new session modal with arbiter loop and sandbox options
4. Make bundled content read-only with silent updates and fork-to-customize

## 1. Sandbox Decoupling

### Current State

Sandbox is tied to `arbiter_enabled` on the project. Every PTY session for an arbiter-enabled project gets sandboxed automatically. No user choice per-session.

### Design

- Remove sandbox logic from `arbiter_enabled`. They are orthogonal concerns.
- Add "Isolated environment" toggle to the new session modal.
- Only visible on Linux and macOS. Hidden on Windows (not supported).
- Platform detection: call `get_sandbox_capabilities` on app startup, cache result in `settingsStore`.
- When enabled, sandbox uses the project's trust level if arbiter is enabled, otherwise defaults to Autonomous (level 2).
- Visual indicator: shield icon on the session tab in the sidebar when sandboxed.
- Store `sandboxed: boolean` on `AgentSession` type.

### Files Affected

- `src/features/agents/components/NewAgentDialog.tsx` — add toggle
- `src/stores/settingsStore.ts` — cache sandbox capabilities
- `src/types/index.ts` — add `sandboxed` to `AgentSession`
- `src/components/layout/Sidebar.tsx` — show shield icon on sandboxed sessions
- `src-tauri/src/commands/pty_commands.rs` — sandbox_enabled already a parameter, no backend change needed

## 2. New Session Modal Redesign

### Current State

Modal has: agent type selector, optional label, optional initial prompt, YOLO mode toggle.

### Design

Fields in order of appearance:

1. **Agent type selector** — unchanged
2. **Label** — unchanged
3. **Initial prompt** — unchanged, but becomes required when arbiter loop is enabled
4. **YOLO mode toggle** — unchanged
5. **Isolated environment toggle** — new. Shield icon + "Isolated environment" label. Only visible on Linux/macOS. Default: off.
6. **Arbiter session toggle** — new. When toggled on, reveals:
   - **Max loops** — slider + numeric input side by side. Min 1, max 50, default 10.
   - **Cost warning** — muted text: "Each loop iteration uses one CLI session. Higher values increase token usage."

### Validation

- If arbiter toggle is on, initial prompt is required (show validation error if empty on submit).
- Max loops clamped to 1–50.

### Files Affected

- `src/features/agents/components/NewAgentDialog.tsx` — add all new fields
- `src/types/index.ts` — add `arbiterEnabled`, `maxIterations` to `AgentSession`

## 3. Arbiter Loop in Terminal View

### Current State

Loop is a standalone panel (`features/loop/`) with its own navigation entry, LoopFloatingPreview, and dedicated LoopPanel. The loop engine spawns separate PTY sessions per story.

### Design: Hybrid Single-Pane Model

#### Execution Model

- Arbiter loop runs in the terminal panel, not a separate panel.
- One terminal pane visible to the user.
- The loop engine kills and respawns the agent process within the same PTY pane for each story.
- User sees a continuous stream in one terminal. Each story starts with a fresh agent process.
- Completion detection: process exit = story done.
- Between stories, the loop engine automatically spawns the next agent with the next story's prompt.

#### Artifacts Pane

- When an arbiter+loop session starts, the grid auto-splits the active pane to add an artifacts pane (70/30 ratio, terminal left, artifacts right).
- The artifacts pane is a regular grid pane but renders a status view instead of xterm.js.
- Pane type: extend `TerminalPaneLayoutNode` with a `paneType` field: `"terminal"` (default) or `"artifacts"`.
- Artifacts pane is tied to a specific session ID.

#### Artifacts Pane Content (top to bottom)

1. **Header** — "Arbiter" label + current story title + iteration counter ("2/10") + collapse/close button
2. **Story list** — compact list with status dots (pending/running/completed/failed). Click to expand details inline.
3. **Active story detail** — description, acceptance criteria (expandable)
4. **Quality gates** — live results as gates run (build: pass, lint: fail, etc.)
5. **Reasoning log** — scrollable list of arbiter decisions

#### Artifacts Pane Behavior

- Auto-created when arbiter+loop session spawns.
- User can resize, move, or close it via normal grid drag/resize controls.
- If closed, a small button on the session tab allows reopening.
- Only one artifacts pane per arbiter session.

#### What Gets Removed

- `src/features/loop/` — entire directory (LoopPanel, LoopControls, LoopFloatingPreview, StoryList)
- `LoopFloatingPreview` from `App.tsx`
- "loop" entry from sidebar navigation
- `activePanel === "loop"` rendering in `App.tsx`

#### What Gets Kept/Moved

- `loopStore.ts` — simplified. Keeps data management (stories, events, gates, reasoning log) but removes panel state. Event listener stays.
- Loop engine backend — unchanged (circuit breaker, quality gates, arbiter judge, prompt delivery).
- The engine needs one change: instead of spawning fresh PTY sessions with unique IDs per story, it reuses the session's PTY pane by killing the old process and spawning a new one in the same pane.

### Files Affected

- `src/types/index.ts` — add `paneType` to `TerminalPaneLayoutNode`
- `src/stores/sessionStore.ts` — handle artifacts pane creation/removal in layout tree
- `src/features/terminal/components/TerminalContainer.tsx` — render artifacts pane when `paneType === "artifacts"`
- Create: `src/features/terminal/components/ArtifactsPane.tsx` — the artifacts view component
- Create: `src/features/terminal/components/ArtifactsPane.module.css`
- `src/stores/loopStore.ts` — simplify, remove panel state
- `src/App.tsx` — remove Loop panel mounting, remove LoopFloatingPreview
- `src/components/layout/Sidebar.tsx` — remove loop navigation entry
- `src-tauri/src/loop_engine/engine.rs` — reuse PTY pane instead of spawning separate sessions per story

## 4. Bundled Content: Read-Only with Fork-to-Customize

### Current State

Bundled personas/skills are seeded once (version "1"). No upgrade path. No way to re-seed. Users can edit bundled content directly, creating implicit conflicts.

### Design

#### Schema Changes

Add two columns to `context_units` table:

- `is_bundled INTEGER NOT NULL DEFAULT 0` — marks bundled (read-only) items
- `bundled_slug TEXT` — stable identifier for matching across versions (e.g., `"backend-developer"`, `"testing-best-practices"`)

Migration: update existing bundled units to set `is_bundled = 1` and `bundled_slug` based on name matching.

#### Bundled Unit Lifecycle

- **First install:** Seed all bundled units with `is_bundled = 1` and their slug.
- **App update with new seed version:** Silently upsert bundled units by slug. Insert new ones, update existing ones. Never delete.
- **No prompt needed.** Bundled content is a reference library that stays current automatically.

#### UI Rules for Bundled Content

- Bundled units show a "Built-in" badge in the context panel.
- **Edit button hidden** for bundled items. Replace with "Duplicate" button.
- **Delete button hidden** for bundled items.
- "Duplicate" creates a new context unit with `is_bundled = 0`, `bundled_slug = NULL`, name prefixed with "Custom — " (editable), and all content copied.
- Duplicated items are fully editable and deletable.

#### Seed System Changes

- Each `BundledUnit` struct gets a `slug: &'static str` field.
- `seed_bundled_content` becomes `sync_bundled_content`:
  - On version mismatch: upsert by slug (INSERT OR REPLACE matching on `bundled_slug`).
  - New bundled units are inserted.
  - Removed bundled units (slug no longer in BUNDLED_*): left in place but `is_bundled` set to 0 (becomes user-owned).
- Version check stays the same (settings key `bundled_seed_version`).

#### Database Reset

- New button in Settings panel under a "Data" section: "Reset database"
- Confirmation modal: "This will delete all projects, sessions, memories, and context. The app will restart with a fresh database. This cannot be undone."
- Implementation: delete `ove.db` file, call `app.restart()`.

### Files Affected

- `src-tauri/src/db/init.rs` — add migration for `is_bundled` and `bundled_slug` columns
- `src-tauri/src/bundled/personas.rs` — add `slug` field to each BundledUnit
- `src-tauri/src/bundled/skills.rs` — add `slug` field to each BundledUnit
- `src-tauri/src/bundled/seed.rs` — rewrite as `sync_bundled_content` with upsert logic
- `src/features/context/components/ContextUnitCard.tsx` — hide edit/delete for bundled, show duplicate
- `src/features/context/components/ContextPanel.tsx` — add duplicate handler
- `src/features/settings/components/SettingsModal.tsx` — add reset database button
- `src-tauri/src/commands/settings_commands.rs` — add `reset_database` command

## 5. Removed Components

| Component | Reason |
|---|---|
| `src/features/loop/` (entire directory) | Replaced by artifacts pane in terminal |
| `LoopFloatingPreview` | No longer needed — artifacts pane shows status |
| Loop sidebar nav entry | No separate loop panel |
| Sandbox tied to `arbiter_enabled` | Decoupled into per-session toggle |

## 6. Migration Path

### For existing users

1. Existing arbiter-enabled projects keep their settings but sandbox becomes a per-session choice.
2. Existing loop stories in the database are preserved. Users can start new arbiter sessions to re-decompose.
3. Existing bundled content gets `is_bundled = 1` and slug assigned via database migration.
4. The Loop panel disappears from navigation. Users use arbiter sessions in terminal instead.
