# ove.run — Stability & UX Sprint Design
**Date:** 2026-03-17
**Status:** Approved
**Approach:** Option 2 — Parallel tracks across 4 iterations

---

## App Purpose

**ove.run** is a terminal-native desktop orchestrator for AI coding agents. It enables developers to run, supervise, and automate multiple AI agents (Claude Code, Gemini, Copilot, Codex) simultaneously — with a trust-based Arbiter that auto-answers prompts, a Loop Engine that decomposes requests into stories and executes them autonomously, and deep context management (personas, skills, memories) injected into agents at runtime.

**Core job to be done:** Make advanced agent workflows feel understandable, trustworthy, and practical. Developers should be able to delegate more without losing oversight.

---

## Current State Assessment

| Dimension | Status |
|---|---|
| Test coverage | ~2% — 2 of 14 stores tested, 0 integration tests, 0 E2E |
| Backend robustness | Moderate — loop engine has no integration tests, PTY cleanup incomplete, arbiter can hang |
| UX completeness | Partial — loop outcomes opaque, layout not persisted, context summarization not wired |
| CI/CD | None — manual build scripts only |
| Sandboxing | Designed but not enforced |

---

## Sprint Goal

Deliver two tracks simultaneously over 4 iterations:

- **Track A (Stability):** Comprehensive test coverage, error recovery, transaction safety, CI/CD
- **Track B (UX):** Loop outcome visibility, session layout persistence, context summarization, reasoning transparency

---

## Iteration 1-alpha *(hard minimum)*

### 1A — Store Tests + DB Transaction Safety

**Scope:**
- Add vitest tests for all 12 untested Zustand stores:
  - `arbiterStore`, `bugsStore`, `contextStore`, `memoryStore`, `notificationStore`
  - `projectStore`, `settingsStore`, `tourStore`, `uiStore`, `agentFeedbackStore`
  - Key `lib/` utilities: `feedbackParser`, `patterns`, `layout`
- Add SQLite transaction wrappers around multi-step writes that currently risk partial failure:
  - Story create + arbiter_state update
  - Session persist + layout write (when implemented)
  - Memory batch insert + consolidation trigger

**Test strategy:**
- Each store: mock Tauri IPC (`vi.mock('@tauri-apps/api/core')`), test all actions and derived state
- `feedbackParser`: test option detection, free-text flags, edge cases
- `patterns`: test status detection regexes against real agent output samples

**Acceptance criteria:**
- All 14 stores have at least one test file
- DB ops that touch 2+ tables use `BEGIN TRANSACTION / COMMIT / ROLLBACK`
- `vitest run` passes with no failures

---

## Iteration 1-beta *(stretch, ships after 1-alpha)*

### 1B — Session Layout Persistence + Loop Outcome Summary

**Session layout persistence:**

> **Architecture decision (revised):** `globalLayout` is app-level UI state, not per-session data. It must NOT be stored in the `sessions` table — that table is filtered on write (pruning `error`/`finished` sessions) which would silently delete the layout. Instead, use a dedicated `app_state` key-value table:
> ```sql
> CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
> ```
> Persist `globalLayout` with: `INSERT OR REPLACE INTO app_state (key, value) VALUES ('global_layout', <json>)`.
> This is migration v5. Load on startup before `loadPersistedSessions()`.

- Persist `globalLayout` JSON to `app_state` on every layout change (debounced 500ms)
- Load layout on startup; reconstruct pane tree from JSON
- Graceful fallback to default layout if JSON is invalid or referenced sessions no longer exist
- Validate that `paneType` field is preserved on round-trip (artifact panes carry `paneType: "artifacts"` — if this field is dropped during deserialization, artifact pane cleanup breaks)

**Loop outcome summary panel:**
- Replace ArtifactsPane blank state after loop ends with `LoopSummaryPanel`
- Shows when loop status is `completed`, `failed`, or `exhausted`
- Displays:
  - Overall status badge (success / partial / failed)
  - Stories table: title, status, iteration count, gate results
  - Failure reasons per story (from `StoryFailed.reason`)
  - Total iterations used vs max
  - "Run more" button for `exhausted` state (existing)

**Acceptance criteria:**
- Restarting app restores last pane layout
- `paneType: "artifacts"` survives JSON round-trip
- Loop summary renders for all terminal states
- No layout flickering on startup

---

## Iteration 2

### 2A — ArbiterDispatch Trait Refactor + PTY Graceful Cleanup

> **Scope clarification:** The loop engine currently calls `crate::arbiter::dispatch::dispatch()` as a free function with no abstraction layer. Before writing integration tests, a trait refactor is required. This is a prerequisite structural change, not a test task. It is scoped as the primary deliverable of 2A; the full test suite ships alongside or immediately after.

**ArbiterDispatch trait (prerequisite):**
- Define `trait ArbiterDispatch: Send + Sync` with method `dispatch(action, project_path, prompt) -> Result<String, AppError>`
- Add `Arc<dyn ArbiterDispatch>` parameter to `run_loop()` and all internal helpers that call dispatch
- Provide `RealArbiterDispatch` (calls existing `dispatch.rs`) and `MockArbiterDispatch` (returns configurable fixture responses) implementations
- Update Tauri command layer to inject `Arc::new(RealArbiterDispatch)` at the call site

**Loop engine integration tests (Rust):**
- Create `src-tauri/src/loop_engine/tests/` module with `MockArbiterDispatch`
- Test cases:
  - `story_completes_on_first_attempt` — mock arbiter returns pass
  - `story_retries_on_gate_failure` — gate fails, retry fires, succeeds
  - `circuit_breaker_trips_at_max_retries` — exceeds trust-level retry limit
  - `no_commit_breaker_pauses_loop` — 3 iterations, no git commit detected
  - `loop_exhausted_at_max_iterations` — stops cleanly, emits `LoopExhausted`
  - `story_dependency_ordering` — stories with `depends_on` execute in correct order

**PTY graceful cleanup:**
- Register Tauri `on_window_event(WindowEvent::Destroyed)` handler
- On destroy: kill all active PTYs, cancel running loop, flush memory worker
- On loop cancel: emit `LoopCancelled` event, kill story PTY, update story status to `failed`
- Add 3s drain timeout before force-kill

**Acceptance criteria:**
- Trait refactor compiles; existing app behavior unchanged
- All 6 loop integration tests pass via `cargo test`
- No orphaned `claude-code` / `gemini` processes after app close
- Loop cancel cleans up within 3s

---

### 2B — Context L0/L1 Auto-Summarization

> **Dependency note:** This feature calls arbiter dispatch before the timeout (3A) is in place. If the arbiter CLI hangs, the `summarize_context_unit` command will hang indefinitely. Add an inline `tokio::time::timeout(Duration::from_secs(60))` in the command handler as a temporary safeguard until 3A ships the full configurable timeout.

**Backend:**
- New Tauri command: `summarize_context_unit(project_id, unit_id) -> Result<(String, String), String>`
- Calls arbiter agent with prompt: generate L0 (≤15 words) and L1 (≤100 words) from L2 content
- Uses project's `arbiter_agent_type` setting
- Wraps call in `tokio::time::timeout(60s)` as a temporary safeguard (superseded by 3A)
- Returns `{ l0_summary, l1_overview }`, saves to DB

**Frontend:**
- "Auto-summarize" button in `ContextUnitEditor` next to L0/L1 fields
- Shows spinner during generation
- Populates fields on success, shows error toast on failure (including timeout)
- Button disabled if L2 content is empty

**Acceptance criteria:**
- Clicking "Auto-summarize" on any context unit with L2 content populates L0/L1
- Empty L2 blocks the button
- Error and timeout states shown clearly

---

## Iteration 3

### 3A — Arbiter CLI Timeout + PTY Death Recovery

**Arbiter timeout (replaces 2B inline timeout):**
- Wrap all `arbiter_dispatch()` calls in `dispatch.rs` with `tokio::time::timeout(Duration::from_secs(120))`
- On timeout: return `Err(AppError::Other("arbiter timeout".into()))`
- Configurable via settings: `arbiter_timeout_seconds` (default 120)
- Loop engine treats timeout as story failure, applies circuit breaker
- Remove the inline 60s timeout added in 2B's command handler (now superseded)

**PTY death during loop:**
- `loop_engine/engine.rs`: listen for `pty-exit-{session_id}` while story active
- On unexpected exit (non-zero code): mark story `failed`, set reason `"Agent process exited unexpectedly (code {n})"`
- Apply circuit breaker: retry if within trust-level limit, else emit `StoryFailed`
- Emit `LoopFailed` if no more retries and no remaining stories

**Acceptance criteria:**
- Arbiter calls that exceed 120s return a timeout error, not a hang
- Killing a PTY mid-story causes loop to retry or fail gracefully, not hang
- No panics or deadlocks in background workers
- 2B summarize command uses the new centralized timeout (no duplicate logic)

---

### 3B — `reasoningLog` Store Field + Reasoning Log UI

**prerequisite — add `reasoningLog` to `loopStore`:**
- Add field `reasoningLog: ReasoningEntry[]` to `loopStore` state (type already defined as `ReasoningEntry { action, reasoning, timestamp }`)
- Subscribe to `ReasoningEntry` loop events via `handleEvent`; append to log (cap at 100 entries, drop oldest)
- Clear `reasoningLog` on `startLoop`

**Reasoning log timeline:**
- In ArtifactsPane, add a "Reasoning" tab alongside loop summary
- Renders `loopStore.reasoningLog` as a vertical timeline
- Each entry: action label (e.g. `JudgeCompletion`), reasoning text (expandable), relative timestamp
- Auto-scrolls to latest entry while loop is running
- Empty state: "No reasoning entries yet — start a loop to see Arbiter decisions"

**Per-story arbiter decision:**
- In `LoopSummaryPanel`, each story row has an expandable "Why?" section
- Shows arbiter reasoning entries that occurred during that story (matched by timestamp proximity to story start/end)
- Shows gate pass/fail details inline

**Acceptance criteria:**
- `reasoningLog` populates during loop; clears on new loop start
- Reasoning log visible and scrollable during active loop
- Each story in summary has expandable arbiter context
- No performance issues with 100+ reasoning entries

---

## Iteration 4

### 4A — GitHub Actions CI + Agent Version Checking

**CI pipeline (`.github/workflows/ci.yml`):**
```yaml
on: [push, pull_request]
jobs:
  frontend:
    - pnpm install
    - npx tsc --noEmit
    - npx vitest run
  backend:
    - cargo test --all
    - cargo clippy -- -D warnings
    - cargo fmt --check
```
- Runs on Ubuntu latest (fastest for Rust)
- Cache: pnpm store, cargo registry, cargo build

**Agent version checking:**
- On app start, run `<agent-cli> --version` for each installed agent
- Compare against minimum required versions in `agent_registry`
- Show warning toast if below minimum: "Claude Code v0.2.0+ required, found v0.1.x"
- Settings → Agents shows version badge per agent

**Acceptance criteria:**
- CI passes on clean clone
- Version warnings shown for out-of-date agents
- Unknown agents (not installed) show "Not found" gracefully

---

### 4B — Memory Decay UI + Loop Story Detail View

**Memory decay controls:**
- In `MemoryPanel`, add per-memory actions: "Mark stale" (sets `decayed_at = now`)
- Show decay status: faded styling + "Decayed" badge for stale memories
- Bulk prune button: "Remove all decayed" — confirmation dialog
- Importance score displayed as colored bar (low/medium/high)

**Loop story detail view:**
- Clicking a story row in `LoopSummaryPanel` opens a `LoopStoryDetail` drawer
- Shows:
  - Title, description, acceptance criteria
  - Final status (completed / failed / pending)
  - Iteration history: each attempt with gate results, arbiter reasoning, exit code
  - Timeline of events (story started, gate ran, arbiter judged, retried, etc.)
- Drawer uses existing `AppModal` shell with wide layout

**Acceptance criteria:**
- Every story in the loop summary is clickable
- Detail drawer shows complete iteration history
- Memory decay marking persists across restarts

---

## Architecture Decisions

### Layout persistence schema (revised)
```sql
-- Migration v5: app-level UI state store (not session-scoped)
CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR REPLACE INTO app_state (key, value) VALUES ('global_layout', '{}');
```
Rationale: `globalLayout` is app-level, not per-session. Using `sessions` table was incorrect — that table prunes `error`/`finished` rows on write, which would silently delete the persisted layout. A dedicated `app_state` KV table is simpler and correctly scoped.

### Loop engine test isolation (revised)
Define `ArbiterDispatch` trait injected via `Arc<dyn ArbiterDispatch>` into `run_loop()`. The trait refactor is iteration 2A's primary deliverable — it is a prerequisite for the test suite, not an incidental task. `RealArbiterDispatch` wraps the existing `dispatch.rs`; `MockArbiterDispatch` returns configurable fixture responses in tests.

### Arbiter timeout location
Timeout applied in `arbiter/dispatch.rs` wrapping the CLI `Command::output()` call. Protects all arbiter callers (loop, summarize, decompose) uniformly. A temporary 60s inline timeout is added in 2B's command handler and removed when 3A ships.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| `app_state` table conflicts with existing migration sequence | Assign as migration v5; check for table existence before creating |
| `paneType` field lost on layout JSON round-trip | Validate deserialized layout preserves `paneType` on artifact pane nodes; log warning and strip artifact pane if field missing |
| Trait refactor breaks existing app behavior | Compile test + manual smoke test before running integration tests |
| Arbiter timeout too low for slow models | Configurable via settings; 2B uses 60s as interim floor |
| Loop engine tests require async runtime | Use `#[tokio::test]` macro |
| CI Rust build slow on GitHub Actions | Cache `~/.cargo` and `./target` |
| PTY drain timeout (3s) too short on slow systems | Configurable, default raised if feedback received |
| Iteration 1 overloaded: 1A + 1B is two sessions of work | Explicitly split as 1-alpha (1A, hard minimum) and 1-beta (1B, stretch); 1-beta only starts after 1-alpha passes |

---

## Success Metrics

After all 4 iterations:
- Test coverage: **≥60% of stores, ≥6 Rust integration tests**
- Zero orphaned processes on app close
- Session pane layout survives restart with `paneType` integrity
- Loop outcomes fully visible (story results, gate details, arbiter reasoning)
- CI green on every push
- Context units can self-summarize from L2
- Arbiter cannot hang indefinitely
