# Architecture Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed errors, database migrations, auto-generated TS types, structured logging, user-facing error feedback, and key-feature tests to the ove.run desktop app.

**Architecture:** Six independent subsystems are improved in dependency order: (1) typed errors in Rust, (2) database migration framework, (3) auto-generated TypeScript types from Rust structs, (4) structured logging via `tracing`, (5) user-facing error toasts on the frontend, (6) tests for key features. Each task produces a working, committable unit.

**Tech Stack:** Rust (thiserror, tracing, tracing-subscriber, ts-rs), TypeScript (vitest), Tauri 2, SQLite, Zustand, Mantine 7

---

## Chunk 1: Typed Errors & Database Migrations

### Task 1: Add `thiserror` and define `AppError` enum

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/error.rs`
- Modify: `src-tauri/src/lib.rs` (add `pub mod error;`)

- [ ] **Step 1: Add `thiserror` dependency**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
thiserror = "2"
```

- [ ] **Step 2: Create `src-tauri/src/error.rs`**

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("PTY error: {0}")]
    Pty(String),

    #[error("Git error: {0}")]
    Git(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Channel error: {0}")]
    Channel(String),

    #[error("Lock poisoned: {0}")]
    Lock(String),

    #[error("Validation: {0}")]
    Validation(String),

    #[error("{0}")]
    Other(String),
}

// Tauri commands require error types that implement Serialize.
// We serialize as a JSON object with `kind` and `message` fields
// so the frontend can distinguish error categories.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let kind = match self {
            AppError::Db(_) => "db",
            AppError::Io(_) => "io",
            AppError::Pty(_) => "pty",
            AppError::Git(_) => "git",
            AppError::NotFound(_) => "not_found",
            AppError::Channel(_) => "channel",
            AppError::Lock(_) => "lock",
            AppError::Validation(_) => "validation",
            AppError::Other(_) => "other",
        };
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// Helper to convert mutex lock errors.
pub fn lock_err<T>(err: std::sync::PoisonError<T>) -> AppError {
    AppError::Lock(err.to_string())
}
```

- [ ] **Step 3: Register the module in `src-tauri/src/lib.rs`**

Add `pub mod error;` alongside the other `pub mod` declarations (after line 17).

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors (warnings about unused code are fine)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/error.rs src-tauri/src/lib.rs
git commit -m "feat: add typed AppError enum with thiserror"
```

---

### Task 2: Migrate PTY commands to `AppError`

This task demonstrates the migration pattern. Other command modules follow the same pattern later.

**Files:**
- Modify: `src-tauri/src/commands/pty_commands.rs`

- [ ] **Step 1: Update return types to use AppError**

Replace the contents of `src-tauri/src/commands/pty_commands.rs`:

```rust
use std::collections::HashMap;
use tauri::{AppHandle, State};
use crate::error::AppError;
use crate::state::AppState;
use crate::sandbox;

#[tauri::command]
pub async fn spawn_pty(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    env: HashMap<String, String>,
    cols: u16,
    rows: u16,
    #[allow(unused_variables)]
    sandbox_enabled: Option<bool>,
    #[allow(unused_variables)]
    trust_level: Option<u32>,
) -> Result<(), AppError> {
    let (final_cmd, final_args, final_env) = if sandbox_enabled.unwrap_or(false) {
        let level = trust_level.unwrap_or(2);
        sandbox::wrap_command(level, &cwd, &command, &args, &env)
    } else {
        (command, args, env)
    };

    let mut manager = state.pty_manager.write().await;
    manager
        .spawn(session_id, final_cmd, final_args, cwd, final_env, cols, rows, app)
        .map_err(|e| AppError::Pty(e))
}

#[tauri::command]
pub async fn write_pty(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.write(&session_id, data).map_err(|e| AppError::Pty(e))
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.resize(&session_id, cols, rows).map_err(|e| AppError::Pty(e))
}

#[tauri::command]
pub async fn kill_pty(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.kill(&session_id).map_err(|e| AppError::Pty(e))
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles. The PtyManager methods still return `Result<T, String>`, so we wrap with `.map_err(|e| AppError::Pty(e))`. No changes needed to PtyManager itself yet.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/pty_commands.rs
git commit -m "refactor: migrate pty_commands to typed AppError"
```

---

### Task 3: Migrate remaining command modules to `AppError`

Apply the same pattern to all other command modules. Each module replaces `Result<T, String>` with `Result<T, AppError>` and uses the appropriate error variant.

**Files:**
- Modify: `src-tauri/src/commands/git_commands.rs`
- Modify: `src-tauri/src/commands/project_commands.rs`
- Modify: `src-tauri/src/commands/settings_commands.rs`
- Modify: `src-tauri/src/commands/notes_commands.rs`
- Modify: `src-tauri/src/commands/agent_commands.rs`
- Modify: `src-tauri/src/commands/session_commands.rs`
- Modify: `src-tauri/src/commands/context_commands.rs`
- Modify: `src-tauri/src/commands/memory_commands.rs`
- Modify: `src-tauri/src/commands/arbiter_commands.rs`
- Modify: `src-tauri/src/commands/loop_commands.rs`
- Modify: `src-tauri/src/commands/bugs_commands.rs`
- Modify: `src-tauri/src/commands/sandbox_commands.rs`

- [ ] **Step 1: Apply the migration pattern to each file**

For each command module:
1. Replace `use` of `String` error with `use crate::error::{AppError, lock_err};`
2. Change return types from `Result<T, String>` to `Result<T, AppError>`
3. Replace `db.lock().map_err(|e| e.to_string())?` with `db.lock().map_err(lock_err)?`
4. Replace `.map_err(|e| e.to_string())?` on rusqlite calls with just `?` (From impl handles it)
5. Replace `.map_err(|e| format!("...: {}", e))?` on channel sends with `.map_err(|e| AppError::Channel(e.to_string()))?`
6. Replace `.map_err(|e| format!("...: {}", e))?` on git subprocess calls with `.map_err(|e| AppError::Git(e.to_string()))?`

Specific patterns by module:
- **git_commands**: Use `AppError::Git(...)` for subprocess failures
- **project_commands**: Use `AppError::Db` (via `?`) for db calls, `AppError::Git` for arbiter_review subprocess
- **settings_commands**: Use `?` for db calls (From impl)
- **notes_commands**: Use `?` for db calls
- **context_commands**: Use `?` for db calls, `AppError::Channel` for memory worker sends
- **memory_commands**: Use `?` for db calls, `AppError::Channel` for worker sends
- **arbiter_commands**: Use `?` for db calls
- **loop_commands**: Use `AppError::Channel` for loop_cmd_tx sends, `?` for db calls
- **bugs_commands**: Use `?` for db calls, `AppError::Other` for HTTP/OAuth errors
- **sandbox_commands**: Use `AppError::Other` for detection failures

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "refactor: migrate all command modules to typed AppError"
```

---

### Task 4: Build database migration framework

**Files:**
- Modify: `src-tauri/src/db/init.rs`

- [ ] **Step 1: Replace ad-hoc `run_migrations` with version-tracked system**

Replace the `run_migrations` function and add a migrations table to the schema in `src-tauri/src/db/init.rs`:

Add to the end of the `SCHEMA` constant (before the closing `"#;`):

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
```

Replace the `run_migrations` function:

```rust
struct Migration {
    version: i32,
    description: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "reduce default max_iterations from 50 to 10",
        sql: "UPDATE arbiter_state SET max_iterations = 10 WHERE max_iterations = 50",
    },
];

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    for migration in MIGRATIONS {
        if migration.version <= current_version {
            continue;
        }
        conn.execute_batch(migration.sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                migration.version,
                migration.description,
                chrono::Utc::now().to_rfc3339(),
            ],
        )?;
    }

    Ok(())
}
```

Add `use chrono` at the top if not already imported.

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors

- [ ] **Step 3: Verify migration runs on existing database**

Run: `cd src-tauri && cargo build && cargo run`
Expected: app starts, migration 1 is recorded in `schema_migrations` table. Subsequent starts skip it.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/init.rs
git commit -m "feat: add versioned database migration framework"
```

---

## Chunk 2: Auto-Generated TypeScript Types

### Task 5: Add `ts-rs` and annotate Rust structs

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/error.rs`

- [ ] **Step 1: Add `ts-rs` dependency**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
ts-rs = { version = "10", features = ["serde-compat"] }
```

- [ ] **Step 2: Annotate structs in `src-tauri/src/state.rs`**

Add `use ts_rs::TS;` at the top. Then add `#[derive(TS)]` and `#[ts(export)]` to each struct/enum that has a TypeScript counterpart:

```rust
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Project { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AgentType { /* variants unchanged */ }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus { /* variants unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AppSettings { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GlobalSettings { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AgentSettings { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ContextUnit { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Memory { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Consolidation { /* fields unchanged */ }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, TS)]
#[ts(export)]
#[repr(u8)]
pub enum TrustLevel { /* variants unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ArbiterStateRow { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Story { /* fields unchanged */ }

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct QualityGateConfig { /* fields unchanged */ }
```

Do NOT add `TS` to `AgentDefinition` (it doesn't derive `Serialize`/`Deserialize`) or `PromptDelivery` (internal-only).

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles

- [ ] **Step 4: Generate TypeScript bindings**

Run: `cd src-tauri && cargo test export_bindings -- --ignored 2>/dev/null; ls bindings/ 2>/dev/null || echo "ts-rs exports on test run"`

With ts-rs v10, types export to `src-tauri/bindings/` by default. Run:

```bash
cd src-tauri && cargo test
```

Then verify the generated files:

```bash
ls src-tauri/bindings/
```

Expected: `.ts` files for each exported type (Project.ts, AgentType.ts, etc.)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/state.rs src-tauri/bindings/
git commit -m "feat: add ts-rs for auto-generated TypeScript type bindings"
```

---

### Task 6: Integrate generated types into frontend

**Files:**
- Create: `src/types/generated.ts` (barrel re-export)
- Modify: `src/types/index.ts` (replace manual definitions with generated ones)

- [ ] **Step 1: Create barrel re-export file**

Create `src/types/generated.ts` that re-exports from the bindings directory:

```typescript
// Auto-generated types from Rust via ts-rs.
// Do NOT edit manually — run `cd src-tauri && cargo test` to regenerate.
export type { Project } from "../../src-tauri/bindings/Project";
export type { AgentType } from "../../src-tauri/bindings/AgentType";
export type { AgentStatus } from "../../src-tauri/bindings/AgentStatus";
export type { AppSettings } from "../../src-tauri/bindings/AppSettings";
export type { GlobalSettings } from "../../src-tauri/bindings/GlobalSettings";
export type { AgentSettings } from "../../src-tauri/bindings/AgentSettings";
export type { ContextUnit } from "../../src-tauri/bindings/ContextUnit";
export type { Memory } from "../../src-tauri/bindings/Memory";
export type { Consolidation } from "../../src-tauri/bindings/Consolidation";
export type { TrustLevel } from "../../src-tauri/bindings/TrustLevel";
export type { ArbiterStateRow as ArbiterState } from "../../src-tauri/bindings/ArbiterStateRow";
export type { Story } from "../../src-tauri/bindings/Story";
export type { QualityGateConfig } from "../../src-tauri/bindings/QualityGateConfig";
```

- [ ] **Step 2: Update `src/types/index.ts`**

Remove the manual type definitions for the types now generated. Replace them with re-exports from `./generated`. Keep frontend-only types (AgentSession, TerminalLayoutNode, etc.) that have no Rust counterpart.

The types to remove from `index.ts` and replace with: `export type { Project, AgentType, AgentStatus, AppSettings, GlobalSettings, AgentSettings, ContextUnit, Memory, Consolidation, TrustLevel, ArbiterState, Story, QualityGateConfig } from "./generated";`

Keep these frontend-only types in `index.ts` (they have no Rust counterpart):
- `TerminalLayoutMode`, `TerminalSplitFlow`, `TerminalPaneDropZone`
- `AgentSession`, `TerminalPaneLayoutNode`, `TerminalSplitLayoutNode`, `TerminalLayoutNode`, `TerminalProjectLayout`
- `AgentDefinition`, `PersistedSession`
- `Note`, `GitFileStatus`, `GitStatus`
- `NotificationItem`, `ParsedOption`, `FeedbackItem`
- `ContextUnitType`, `ContextScope`, `ContextAssignment`
- `LoopStatus`, `StoryStatus`, `GateResult`, `LoopEventType`
- `TRUST_LEVEL_LABELS`

- [ ] **Step 3: Verify frontend compiles**

Run: `pnpm build`
Expected: compiles with no type errors. If there are naming mismatches between ts-rs output and frontend expectations, adjust the `#[ts(rename = "...")]` attribute on the Rust side or the re-export alias.

- [ ] **Step 4: Commit**

```bash
git add src/types/generated.ts src/types/index.ts
git commit -m "feat: replace manual TS types with auto-generated bindings from Rust"
```

---

## Chunk 3: Structured Logging

### Task 7: Add `tracing` to the Rust backend

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add dependencies**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

- [ ] **Step 2: Initialize subscriber in `src-tauri/src/lib.rs`**

At the very start of the `run()` function (before `tauri::Builder::default()`), add:

```rust
use tracing_subscriber::EnvFilter;

tracing_subscriber::fmt()
    .with_env_filter(
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("ove_run_lib=info")),
    )
    .with_target(true)
    .init();

tracing::info!("ove.run starting");
```

- [ ] **Step 3: Replace `eprintln!` calls with `tracing` macros**

Search for `eprintln!` across the Rust codebase (`grep -r "eprintln" src-tauri/src/`) and replace:
- `eprintln!("error: ...")` -> `tracing::error!(...)`
- `eprintln!("warn: ...")` -> `tracing::warn!(...)`
- `eprintln!("debug: ...")` -> `tracing::debug!(...)`
- Other `eprintln!` -> `tracing::warn!(...)` (conservative default)

Key files to update (verified to contain `eprintln!`):
- `src-tauri/src/loop_engine/engine.rs` (11+ calls)
- `src-tauri/src/memory_worker.rs` (4 calls)
- `src-tauri/src/commands/bugs_commands.rs` (5 calls)

Also check and update if present:
- `src-tauri/src/notifications/notifier.rs`
- `src-tauri/src/pty/manager.rs`

- [ ] **Step 4: Add `tracing::instrument` to key command functions**

Add `#[tracing::instrument(skip(state))]` (or `skip(state, app)`) to the top command handlers to get automatic span tracing for PTY, loop, and arbiter commands.

- [ ] **Step 5: Verify it compiles and runs**

Run: `cd src-tauri && cargo check`
Then: `RUST_LOG=ove_run_lib=debug cargo run`
Expected: structured log output in terminal, app starts normally

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/loop_engine/ src-tauri/src/memory_worker.rs src-tauri/src/notifications/ src-tauri/src/pty/
git commit -m "feat: add structured logging with tracing crate"
```

---

## Chunk 4: User-Facing Error Feedback

### Task 8: Add toast notification system to the frontend

**Files:**
- Modify: `src/types/index.ts` (add toast type)
- Modify: `src/stores/notificationStore.ts` (add toast actions)
- Create: `src/components/ui/ToastContainer.tsx`
- Create: `src/components/ui/ToastContainer.module.css`
- Modify: `src/App.tsx` (mount ToastContainer)

- [ ] **Step 1: Add toast type to `src/types/index.ts`**

Add after the `NotificationItem` interface:

```typescript
export type ToastLevel = "error" | "warning" | "success" | "info";

export interface ToastItem {
  id: string;
  level: ToastLevel;
  title: string;
  body?: string;
  duration?: number;
}
```

- [ ] **Step 2: Add toast state to notification store**

Modify `src/stores/notificationStore.ts` to add toast support:

```typescript
import { create } from "zustand";
import type { NotificationItem, ToastItem } from "@/types";
import { v4 as uuid } from "uuid";

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastItem[];
  addNotification: (notification: Omit<NotificationItem, "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  showToast: (level: ToastItem["level"], title: string, body?: string) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],

  addNotification: (notification) => {
    const item: NotificationItem = { ...notification, read: false };
    set((state) => ({
      notifications: [item, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id: string) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  showToast: (level, title, body) => {
    const toast: ToastItem = {
      id: uuid(),
      level,
      title,
      body,
      duration: level === "error" ? 8000 : 4000,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
```

- [ ] **Step 3: Create `src/components/ui/ToastContainer.module.css`**

```css
.container {
  position: fixed;
  bottom: 36px; /* above StatusBar */
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-bright);
  animation: slideIn 200ms ease-out;
  cursor: pointer;
}

.toast[data-level="error"] {
  border-color: var(--danger);
}

.toast[data-level="warning"] {
  border-color: var(--warning);
}

.toast[data-level="success"] {
  border-color: var(--success);
}

.toast[data-level="info"] {
  border-color: var(--accent);
}

.icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.content {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.body {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

- [ ] **Step 4: Create `src/components/ui/ToastContainer.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import type { ToastLevel } from "@/types";
import classes from "./ToastContainer.module.css";

const ICONS: Record<ToastLevel, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const COLORS: Record<ToastLevel, string> = {
  error: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
  info: "var(--accent)",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useNotificationStore();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const toast of toasts) {
      if (timers.current.has(toast.id)) continue;
      const timer = setTimeout(() => {
        dismissToast(toast.id);
        timers.current.delete(toast.id);
      }, toast.duration ?? 4000);
      timers.current.set(toast.id, timer);
    }

    // Cleanup removed toasts
    for (const [id, timer] of timers.current) {
      if (!toasts.some((t) => t.id === id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={classes.container}>
      {toasts.map((toast) => {
        const Icon = ICONS[toast.level];
        return (
          <div
            key={toast.id}
            className={classes.toast}
            data-level={toast.level}
            onClick={() => dismissToast(toast.id)}
          >
            <Icon size={16} className={classes.icon} color={COLORS[toast.level]} />
            <div className={classes.content}>
              <div className={classes.title}>{toast.title}</div>
              {toast.body && <div className={classes.body}>{toast.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Mount in `src/App.tsx`**

Add import: `import { ToastContainer } from "@/components/ui/ToastContainer";`

Add `<ToastContainer />` right before the closing `</div>` of the root element (after `<LoopFloatingPreview />`).

- [ ] **Step 6: Wire up error toasts in key stores**

Update store catch blocks to show toasts instead of (or in addition to) console.error. Example for `projectStore.ts`:

```typescript
import { useNotificationStore } from "./notificationStore";

// In catch blocks:
} catch (err) {
  console.error("Failed to load projects:", err);
  useNotificationStore.getState().showToast("error", "Failed to load projects", String(err));
}
```

Apply to the most critical operations in:
- `projectStore.ts` (loadProjects, addProject, removeProject)
- `sessionStore.ts` (loadPersistedSessions, persistSessions)
- `loopStore.ts` (startLoop, pauseLoop, cancelLoop)
- `contextStore.ts` (loadUnits, createUnit, deleteUnit)

- [ ] **Step 7: Verify it works**

Run: `pnpm build`
Expected: compiles. Toasts appear in bottom-right when errors occur.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/stores/notificationStore.ts src/components/ui/ToastContainer.tsx src/components/ui/ToastContainer.module.css src/App.tsx src/stores/projectStore.ts src/stores/sessionStore.ts src/stores/loopStore.ts src/stores/contextStore.ts
git commit -m "feat: add toast notification system for user-facing error feedback"
```

---

## Chunk 5: Tests for Key Features

### Task 9: Set up Vitest for frontend testing

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Add test script to `package.json`**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Verify vitest runs**

```bash
pnpm test
```

Expected: "No test files found" (correct — none exist yet)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: set up vitest for frontend testing"
```

---

### Task 10: Test the terminal layout tree operations

The `sessionStore.ts` has ~400 lines of pure layout tree functions. These are the highest-value frontend tests — no mocks needed.

**Files:**
- Create: `src/stores/sessionStore.test.ts`

- [ ] **Step 1: Write tests for core tree operations**

```typescript
import { describe, it, expect } from "vitest";

// We need to test the pure functions. They're currently unexported from sessionStore.
// For now, we'll test them through the store API.
// First, let's test layout normalization and pane operations by importing the store.

// Since Zustand stores work outside React, we can test them directly.
import { useSessionStore } from "./sessionStore";
import type { AgentSession } from "@/types";

function makeSession(id: string, projectId: string): AgentSession {
  return {
    id,
    projectId,
    agentType: "claude",
    status: "idle",
    yoloMode: false,
    createdAt: new Date().toISOString(),
    label: `Session ${id}`,
    isResumed: false,
  };
}

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      projectLayouts: {},
    });
  });

  describe("addSession", () => {
    it("adds a session and sets it active", () => {
      const session = makeSession("s1", "p1");
      useSessionStore.getState().addSession(session);

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.activeSessionId).toBe("s1");
    });

    it("creates a layout for the project", () => {
      const session = makeSession("s1", "p1");
      useSessionStore.getState().addSession(session);

      const layout = useSessionStore.getState().projectLayouts["p1"];
      expect(layout).toBeDefined();
      expect(layout.root.type).toBe("pane");
      if (layout.root.type === "pane") {
        expect(layout.root.sessionId).toBe("s1");
      }
    });

    it("places second session in a new pane", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.activeSessionId).toBe("s2");
    });
  });

  describe("removeSession", () => {
    it("removes the session from the list", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().removeSession("s1");

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("s2");
    });

    it("switches active session when removing the active one", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().removeSession("s2");

      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });
  });

  describe("setActiveSession", () => {
    it("updates the active session", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().setActiveSession("s1");

      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });

    it("handles null", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().setActiveSession(null);

      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });
  });

  describe("updateSessionStatus", () => {
    it("updates status without affecting other sessions", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().updateSessionStatus("s1", "working");

      const sessions = useSessionStore.getState().sessions;
      expect(sessions.find((s) => s.id === "s1")?.status).toBe("working");
      expect(sessions.find((s) => s.id === "s2")?.status).toBe("idle");
    });
  });

  describe("splitPane", () => {
    it("creates a split layout when splitting", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = useSessionStore.getState().projectLayouts["p1"];
      const paneId = layout.activePaneId;

      useSessionStore.getState().splitPane("p1", paneId, "right", "s2");

      const updated = useSessionStore.getState().projectLayouts["p1"];
      expect(updated.root.type).toBe("split");
    });
  });

  describe("reorderSessions", () => {
    it("reorders sessions within a project", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().addSession(makeSession("s3", "p1"));

      useSessionStore.getState().reorderSessions("s3", "s1", "p1");

      const ids = useSessionStore.getState().sessions.map((s) => s.id);
      expect(ids).toEqual(["s3", "s1", "s2"]);
    });
  });
});
```

- [ ] **Step 2: Mock the Tauri IPC calls**

The store imports `saveSessions` and `loadSessions` from `@/lib/tauri`, which in turn imports from `@tauri-apps/api/core` and `@tauri-apps/api/event`. Since Tauri APIs are unavailable in a Node test environment, mock the underlying Tauri packages.

Add to the test file (before the describe block):

```typescript
import { vi } from "vitest";

// Mock the underlying Tauri APIs that @/lib/tauri depends on
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 3: Run the tests**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/stores/sessionStore.test.ts
git commit -m "test: add tests for terminal layout tree operations"
```

---

### Task 11: Add Rust tests for circuit breaker

The circuit breaker is pure logic — no I/O, no mocks needed.

**Files:**
- Modify: `src-tauri/src/loop_engine/circuit_breaker.rs`

- [ ] **Step 1: Add test module to `circuit_breaker.rs`**

Append at the end of the file:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{ArbiterStateRow, Story, TrustLevel};

    fn make_state(trust: TrustLevel, iterations: i32, max: i32) -> ArbiterStateRow {
        ArbiterStateRow {
            project_id: "p1".to_string(),
            trust_level: trust,
            loop_status: "running".to_string(),
            current_story_id: Some("s1".to_string()),
            iteration_count: iterations,
            max_iterations: max,
            last_activity_at: None,
        }
    }

    fn make_story(attempts: i32) -> Story {
        Story {
            id: "s1".to_string(),
            project_id: "p1".to_string(),
            title: "Test story".to_string(),
            description: "desc".to_string(),
            acceptance_criteria: None,
            priority: 0,
            status: "in_progress".to_string(),
            depends_on_json: "[]".to_string(),
            iteration_attempts: attempts,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn continues_when_under_all_limits() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_supervised_after_1_retry() {
        let state = make_state(TrustLevel::Supervised, 0, 10);
        let story = make_story(1);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn pauses_autonomous_after_3_retries() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(3);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn allows_autonomous_2_retries() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(2);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_fullauto_after_5_retries() {
        let state = make_state(TrustLevel::FullAuto, 0, 10);
        let story = make_story(5);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn allows_fullauto_4_retries() {
        let state = make_state(TrustLevel::FullAuto, 0, 10);
        let story = make_story(4);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_on_3_consecutive_no_commit() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 3), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn continues_on_2_consecutive_no_commit() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 2), CircuitBreakerAction::Continue));
    }

    #[test]
    fn stops_when_max_iterations_reached() {
        let state = make_state(TrustLevel::Autonomous, 10, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Stop(_)));
    }

    #[test]
    fn retries_checked_before_max_iterations() {
        // Story retries should trigger Pause before max iterations triggers Stop
        let state = make_state(TrustLevel::Autonomous, 10, 10);
        let story = make_story(3);
        // Retries checked first in code order
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd src-tauri && cargo test circuit_breaker -- --nocapture
```

Expected: all 10 tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/loop_engine/circuit_breaker.rs
git commit -m "test: add circuit breaker unit tests"
```

---

### Task 12: Add Rust tests for sandbox policy

**Files:**
- Modify: `src-tauri/src/sandbox/policy.rs`

- [ ] **Step 1: Add test module to `policy.rs`**

Append at the end:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked_paths_includes_ssh() {
        assert!(BLOCKED_PATHS.contains(&".ssh"));
    }

    #[test]
    fn blocked_paths_includes_aws() {
        assert!(BLOCKED_PATHS.contains(&".aws"));
    }

    #[test]
    fn sensitive_patterns_includes_env() {
        assert!(SENSITIVE_PATTERNS.contains(&".env"));
        assert!(SENSITIVE_PATTERNS.contains(&".env.production"));
    }

    #[test]
    fn agent_configs_include_all_supported_agents() {
        assert!(AGENT_CONFIG_PATHS.contains(&".claude"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/gemini"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/gh"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/codex"));
    }

    #[test]
    fn runtime_paths_include_major_runtimes() {
        assert!(RUNTIME_PATHS.contains(&".nvm"));
        assert!(RUNTIME_PATHS.contains(&".cargo"));
        assert!(RUNTIME_PATHS.contains(&".pyenv"));
    }

    #[test]
    fn blocked_paths_do_not_overlap_with_agent_configs() {
        for blocked in BLOCKED_PATHS {
            assert!(
                !AGENT_CONFIG_PATHS.contains(blocked),
                "Blocked path '{}' should not be in agent configs",
                blocked
            );
        }
    }

    #[test]
    fn system_paths_include_ssl_certs() {
        assert!(SYSTEM_READ_PATHS.contains(&"/etc/ssl"));
        assert!(SYSTEM_READ_PATHS.contains(&"/etc/ca-certificates"));
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd src-tauri && cargo test sandbox::policy -- --nocapture
```

Expected: all 7 tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sandbox/policy.rs
git commit -m "test: add sandbox policy tests"
```

---

### Task 13: Add Rust tests for database migrations

**Files:**
- Modify: `src-tauri/src/db/init.rs`

- [ ] **Step 1: Add test module**

Append to `src-tauri/src/db/init.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        conn
    }

    #[test]
    fn schema_creates_all_tables() {
        let conn = in_memory_db();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"projects".to_string()));
        assert!(tables.contains(&"sessions".to_string()));
        assert!(tables.contains(&"stories".to_string()));
        assert!(tables.contains(&"arbiter_state".to_string()));
        assert!(tables.contains(&"memories".to_string()));
        assert!(tables.contains(&"schema_migrations".to_string()));
    }

    #[test]
    fn migrations_run_idempotently() {
        let conn = in_memory_db();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap(); // second run should be a no-op

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, MIGRATIONS.len() as i32);
    }

    #[test]
    fn migration_version_tracks_correctly() {
        let conn = in_memory_db();
        run_migrations(&conn).unwrap();

        let max_version: i32 = conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(max_version, MIGRATIONS.last().map(|m| m.version).unwrap_or(0));
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd src-tauri && cargo test db::init -- --nocapture
```

Expected: all 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/init.rs
git commit -m "test: add database schema and migration tests"
```

---

### Task 14: Add Rust tests for TrustLevel conversion

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add test module**

Append to `src-tauri/src/state.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trust_level_from_valid_values() {
        assert_eq!(TrustLevel::from_i32(1), TrustLevel::Supervised);
        assert_eq!(TrustLevel::from_i32(2), TrustLevel::Autonomous);
        assert_eq!(TrustLevel::from_i32(3), TrustLevel::FullAuto);
    }

    #[test]
    fn trust_level_from_invalid_defaults_to_autonomous() {
        assert_eq!(TrustLevel::from_i32(0), TrustLevel::Autonomous);
        assert_eq!(TrustLevel::from_i32(99), TrustLevel::Autonomous);
        assert_eq!(TrustLevel::from_i32(-1), TrustLevel::Autonomous);
    }

    #[test]
    fn app_settings_default_values() {
        let settings = AppSettings::default();
        assert_eq!(settings.global.font_size, 14);
        assert!(settings.global.notifications_enabled);
        assert!(settings.global.minimize_to_tray);
        assert_eq!(settings.global.terminal_scrollback, 10000);
        assert_eq!(settings.global.arbiter_timeout_seconds, 20);
    }

    #[test]
    fn quality_gate_config_default() {
        let config = QualityGateConfig::default();
        assert!(config.build_command.is_none());
        assert!(config.lint_command.is_none());
        assert!(config.test_command.is_none());
        assert!(config.arbiter_judge);
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd src-tauri && cargo test state::tests -- --nocapture
```

Expected: all 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "test: add state type conversion and default tests"
```

---

### Task 15: Run all tests and verify

- [ ] **Step 1: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass (circuit_breaker, sandbox::policy, db::init, state::tests)

- [ ] **Step 2: Run all frontend tests**

```bash
pnpm test
```

Expected: sessionStore tests pass

- [ ] **Step 3: Verify the full app builds**

```bash
pnpm build && cd src-tauri && cargo build
```

Expected: both frontend and backend build successfully

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve any test/build issues from integration"
```
