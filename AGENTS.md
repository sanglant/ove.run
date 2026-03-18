# Agent Development Guide for ove.run

## Project Overview

ove.run is a Tauri v2 desktop app for orchestrating AI coding agents. React 19 + TypeScript frontend, Rust backend, Zustand state management, Mantine UI, xterm.js terminals, CSS Modules.

## Architecture

### Frontend (`src/`)
- **Stores** (`src/stores/`): Zustand 5 stores. Each store is a singleton. Use `getState()` for reads outside React, `setState()` for direct mutations in tests.
- **Features** (`src/features/`): Domain-specific components organized by feature (terminal, arbiter, agents, bugs, context, git, memory, notes, settings, stats).
- **Components** (`src/components/`): Shared layout (`layout/`), UI primitives (`ui/`), and shared components (`shared/`).
- **Lib** (`src/lib/`): Pure utility functions and Tauri IPC wrappers (`tauri.ts`).
- **Types** (`src/types/`): Shared TypeScript types. Bug types live in `src/features/bugs/types.ts` (should migrate to shared types).
- **Theme** (`src/theme.ts`): Design tokens, CSS custom properties, Mantine theme override.

### Backend (`src-tauri/src/`)
- **loop_engine/**: Autonomous loop that decomposes requests into stories and executes them via agents. Uses `LoopCommand` channel for control.
- **arbiter/**: Trust-based system that auto-answers agent prompts. Dispatches to CLI agents.
- **pty/**: PTY (pseudo-terminal) management. Spawns agent processes, reads output, writes input.
- **db/**: SQLite with FTS5. Modules: context, memory, sessions, stories, bugs. WAL mode.
- **commands/**: Tauri IPC command handlers grouped by domain.
- **notifications/**: Desktop notification system.
- **state.rs**: App state struct with `Arc<RwLock<>>` for thread-safe access.
- **memory_worker.rs**: Background task for memory extraction and consolidation.

### Key Patterns

**Tauri IPC**: Frontend calls `invoke("command_name", { args })` from `@tauri-apps/api/core`. Backend exposes `#[tauri::command]` functions.

**Event system**: Backend emits events via `app_handle.emit("event-name", payload)`. Frontend listens with `listen("event-name", callback)` from `@tauri-apps/api/event`.

**Terminal layout**: Binary tree of split/pane nodes. `TerminalSplitLayoutNode` has `first`/`second` children and a `ratio`. `TerminalPaneLayoutNode` has `sessionId` and optional `paneType`. Layout is global (not per-project).

**Arbiter flow**: Agent outputs prompt → `feedbackParser` detects it → `agentFeedbackStore` enqueues → `AgentFeedbackToast` renders with timer → arbiter auto-answers or user responds manually.

## Key Files

| Purpose | File |
|---------|------|
| App root | `src/App.tsx` |
| Terminal layout renderer | `src/features/terminal/components/TerminalContainer.tsx` |
| Terminal session component | `src/features/terminal/components/TerminalPanel.tsx` |
| Arbiter artifacts pane | `src/features/terminal/components/ArtifactsPane.tsx` |
| Feedback toast (arbiter prompts) | `src/features/arbiter/components/AgentFeedbackToast.tsx` |
| Session/layout store | `src/stores/sessionStore.ts` |
| Loop state store | `src/stores/loopStore.ts` |
| Layout tree utilities | `src/lib/layout.ts` |
| Shared types | `src/types/index.ts` |
| Theme & design tokens | `src/theme.ts` |
| Shared modal | `src/components/ui/AppModal.tsx` |
| Toast container | `src/components/ui/ToastContainer.tsx` |
| Rust lib entry | `src-tauri/src/lib.rs` |
| Rust app state | `src-tauri/src/state.rs` |
| Loop engine | `src-tauri/src/loop_engine/engine.rs` |
| PTY manager | `src-tauri/src/pty/manager.rs` |
| DB init & migrations | `src-tauri/src/db/init.rs` |

## Tour System

Product tours use **driver.js** (`^1.4.0`) for contextual onboarding.

### Architecture

| File | Role |
|------|------|
| `src/hooks/useTour.tsx` | Core hook — `startTour`, `startPanelTour`, `startHomeTour`, `stopTour` |
| `src/hooks/useAutoTour.ts` | Auto-triggers panel tour on first visit (1 s delay, once only) |
| `src/stores/tourStore.ts` | Persisted state: `hasSeenHomeTour`, `seenPanelTours[]` |
| `src/styles/tour.css` | Dark-mode driver.js overrides |
| `src/constants/tours/` | Tour step definitions (one file per panel) |

### Tour Files & Coverage

| Panel | Tour file | Steps | `data-tour` markers |
|-------|-----------|-------|---------------------|
| Home (orientation) | `tours/home.ts` | 11 | sidebar-*, project-arbiter-toggle, statusbar-notifications |
| Terminal | `tours/terminal.ts` | 3 | terminal-tabs, terminal-layout, terminal-new-session |
| Git | `tours/git.ts` | 3 | git-file-list, git-diff, git-commit |
| Context/Knowledge | `tours/knowledge.ts` | 2 | knowledge-file-list, knowledge-editor |
| Notes | `tours/notes.ts` | 2 | notes-list, notes-editor |
| Bugs | `tours/bugs.ts` | 4 | bugs-list, bugs-detail, bugs-delegate, bugs-refresh |
| Bug setup | `tours/bugSetup.ts` | 4 sub-tours | bugs-provider-select, bugs-client-id, bugs-client-secret, bugs-base-url, bugs-project-key |
| Memory | `tours/memory.ts` | 3 | memory-tabs, memory-search, memory-list |
| Stats | `tours/stats.ts` | 3 | stats-overview, stats-loop, stats-memory |

All panel tours are registered in `tours/index.ts` under `panelTours`.

### Adding a New Panel Tour

1. Create `src/constants/tours/<panel>.ts` exporting a `DriveStep[]`.
2. Add the export and `panelTours` entry in `tours/index.ts`.
3. Add a `data-tour="<panel>-*"` attribute to each highlighted element.
4. Add the sidebar nav item's `tourId: "sidebar-<panel>"` in `Sidebar.tsx`.
5. Add a step to `tours/home.ts` referencing `sidebar-<panel>`.
6. Call `useAutoTour("<panel>")` inside the panel component.

### Tour Trigger Flow

1. App loads → 800 ms delay → home tour auto-starts if `hasSeenHomeTour === false`.
2. User visits a panel for the first time → `useAutoTour` fires after 1 s.
3. "?" button in status bar → replays the current panel tour via `startPanelTour(activePanel)`.
4. Bug provider setup → "Instructions" button triggers `genericSetupTour` / provider-specific tour.

## Design System

- **Dark mode only**, amber accent (`var(--accent)`)
- Agent-specific color palettes: `var(--agent-claude)`, `var(--agent-gemini)`, etc.
- Arbiter has teal palette: `var(--arbiter)`
- Use `AppModal` for all dialogs (per CLAUDE.md)
- CSS Modules for component styles, CSS custom properties for tokens
- `prefers-reduced-motion` respected throughout

## Testing

- **Frontend**: Vitest. Mock Tauri IPC with `vi.mock("@tauri-apps/api/core")`. Reset store state in `beforeEach`.
- **Backend**: `cargo test`. Use `#[tokio::test]` for async. Mock arbiter dispatch via trait injection (planned).

## Common Commands

```bash
pnpm run dev          # Start Vite dev server
pnpm run build        # TypeScript check + Vite build
pnpm run test         # Vitest run
npx tsc --noEmit      # Type check only
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Known Issues (as of 2026-03-17)

### All previously critical/high issues have been resolved:
- PTY kill now terminates child processes with 3s graceful drain + force kill
- App shutdown handler kills all PTYs, cancels loops, flushes memory worker
- Arbiter dispatch wrapped in configurable timeout (default 120s)
- DB transactions on story batches, memory consolidation, story reordering
- React ErrorBoundary at root + per-panel level (including Terminal)
- XSS sanitized with DOMPurify, dead code removed, modals migrated to AppModal
- Layout auto-collapses empty panes, arbiter sidebar integrated into terminal pane
- FTS index fixed on bundled unit updates, FTS queries sanitized
- Color contrast (--text-tertiary) fixed to WCAG AA compliance

### Remaining (medium/low priority)
- Quality gate commands use naive whitespace split (`loop_engine/quality_gates.rs`) — consider `sh -c`
- `run_arbiter_cli` hardcodes `-p` flag for all CLI tools — only correct for Claude
- `OutputMonitor` line buffer grows unboundedly (`agents/detection.rs`)
- `consolidations_fts` has fragile rowid (no `content_rowid`, breaks on VACUUM)
- ArtifactsPane reads global loop state, not project-scoped
- All terminal sessions rendered simultaneously regardless of visibility (resource waste)
- No recursion depth guard on layout tree operations
- Arbiter sidebar split ratio not persisted across panel switches
- `kill_all` is O(n * timeout) — could parallelize for faster shutdown
