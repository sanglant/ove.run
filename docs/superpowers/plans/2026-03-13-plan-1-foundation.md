# Plan 1: Foundation — Arbiter Rename & SQLite Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all JSON file storage with a single SQLite database and unify "guardian" naming to "arbiter" across the entire stack.

**Architecture:** Single `ove.db` SQLite file at Tauri's `app_data_dir()`. `rusqlite` with `bundled` + `fts5` features. All existing JSON store modules are replaced by a centralized `db` module. The database is initialized on app startup with schema creation.

**Tech Stack:** rusqlite (Rust), SQLite with FTS5, Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-13-arbiter-extensions-design.md`

---

**Previous plans:** None — this is the first plan.

**What this plan builds:** SQLite database with all tables from the spec, replaces all JSON file storage (projects, settings, sessions, notes, bug configs), renames guardian -> arbiter across the full stack.

**What the next plan needs:** All CRUD operations going through SQLite. The `context_units`, `memories`, `consolidations`, `arbiter_state`, and `stories` tables exist but are empty and unused — Plan 2 (Context Store) and Plan 3 (Agent Memory) will populate them.

---

## File Structure

### New Files
- `src-tauri/src/db/mod.rs` — module export
- `src-tauri/src/db/init.rs` — database initialization, schema creation, connection pool
- `src-tauri/src/db/projects.rs` — project CRUD operations
- `src-tauri/src/db/settings.rs` — settings key/value CRUD
- `src-tauri/src/db/sessions.rs` — session persistence CRUD
- `src-tauri/src/db/notes.rs` — notes CRUD
- `src-tauri/src/db/bugs.rs` — bug config/auth CRUD
- `src-tauri/src/db/context.rs` — context_units table CRUD (empty impl, used in Plan 2)
- `src-tauri/src/db/memory.rs` — memories table CRUD (empty impl, used in Plan 3)
- `src-tauri/src/db/arbiter_state.rs` — arbiter_state table CRUD (empty impl, used in Plan 4)
- `src-tauri/src/db/stories.rs` — stories table CRUD (empty impl, used in Plan 5)

### Modified Files
- `src-tauri/Cargo.toml` — add rusqlite dependency
- `src-tauri/src/lib.rs` — replace JSON init with SQLite init, update AppState, rename guardian commands
- `src-tauri/src/state.rs` — rename guardian fields to arbiter, add DbPool to AppState
- `src-tauri/src/commands/mod.rs` — update module exports
- `src-tauri/src/commands/project_commands.rs` — replace JSON I/O with SQLite queries, rename guardian_review
- `src-tauri/src/commands/knowledge_commands.rs` — remove (replaced by context commands in Plan 2)
- `src-tauri/src/commands/notes_commands.rs` — rewrite to use SQLite
- `src-tauri/src/commands/session_commands.rs` — rewrite to use SQLite
- `src-tauri/src/commands/settings_commands.rs` — rewrite to use SQLite
- `src-tauri/src/commands/bugs_commands.rs` — rewrite store calls to use SQLite
- `src/types/index.ts` — rename guardian types to arbiter, remove KnowledgeEntry/KnowledgeType
- `src/lib/tauri.ts` — rename guardian IPC calls, remove knowledge calls
- `src/lib/arbiter.ts` — rename guardian references
- `src/stores/arbiterStore.ts` — update if any guardian references
- `src/stores/settingsStore.ts` — update default settings keys
- `src/features/settings/components/SettingsModal.tsx` — rename guardian UI labels
- `.gitignore` — add `*.db` pattern

### Deleted Files
- `src-tauri/src/knowledge/` — entire module (replaced by context system in Plan 2)
- `src-tauri/src/notes/store.rs` — replaced by db/notes.rs
- `src-tauri/src/sessions/store.rs` — replaced by db/sessions.rs
- `src-tauri/src/settings/store.rs` — replaced by db/settings.rs

---

## Chunk 1: Arbiter Rename

### Task 1: Rename guardian to arbiter in Rust types

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Rename Project struct fields**

In `src-tauri/src/state.rs`, rename:
```rust
// Before
pub guardian_enabled: bool,
pub guardian_agent_type: Option<String>,

// After
pub arbiter_enabled: bool,
pub arbiter_agent_type: Option<String>,
```

- [ ] **Step 2: Rename GlobalSettings fields**

In `src-tauri/src/state.rs`, rename:
```rust
// Before
pub guardian_timeout_seconds: u32,
pub guardian_provider: String,
pub guardian_model: String,

// After
pub arbiter_timeout_seconds: u32,
pub arbiter_provider: String,
pub arbiter_model: String,
```

Also rename `default_guardian_timeout` to `default_arbiter_timeout`.

- [ ] **Step 3: Verify no remaining guardian references in state.rs**

Run: `grep -rn "guardian" src-tauri/src/state.rs`
Expected: No matches

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "refactor: rename guardian to arbiter in Rust types"
```

### Task 2: Rename guardian to arbiter in Rust commands

**Files:**
- Modify: `src-tauri/src/commands/project_commands.rs`
- Modify: `src-tauri/src/commands/settings_commands.rs`

- [ ] **Step 1: Rename guardian_review to arbiter_review**

In `src-tauri/src/commands/project_commands.rs`, rename the function and its Tauri command name:
```rust
// Before
#[tauri::command]
pub async fn guardian_review(

// After
#[tauri::command]
pub async fn arbiter_review(
```

- [ ] **Step 2: Rename list_cli_models references if any guardian naming exists**

Verify and rename any guardian references in `project_commands.rs`.

- [ ] **Step 3: Update command registration in lib.rs**

In `src-tauri/src/lib.rs`, update the `generate_handler!` macro:
```rust
// Before
commands::project_commands::guardian_review,

// After
commands::project_commands::arbiter_review,
```

- [ ] **Step 4: Verify no remaining guardian references in commands/**

Run: `grep -rn "guardian" src-tauri/src/commands/`
Expected: No matches

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "refactor: rename guardian to arbiter in Rust commands"
```

### Task 3: Rename guardian to arbiter in TypeScript

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/tauri.ts`
- Modify: `src/lib/arbiter.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/features/settings/components/SettingsModal.tsx`

- [ ] **Step 1: Update types/index.ts**

Rename any `guardian_*` fields in `Project`, `GlobalSettings`, and related interfaces to `arbiter_*`.

- [ ] **Step 2: Update lib/tauri.ts**

Rename `guardianReview` IPC call to `arbiterReview` (update the invoke command name string).

- [ ] **Step 3: Update lib/arbiter.ts**

Verify all references use "arbiter" naming. The file already uses arbiter naming for the most part — check the IPC call name matches the renamed Rust command.

- [ ] **Step 4: Update settingsStore.ts default keys**

Rename `guardian_timeout_seconds` -> `arbiter_timeout_seconds` etc. in DEFAULT_SETTINGS.

- [ ] **Step 5: Update SettingsModal.tsx labels**

Rename any UI labels that say "Guardian" to "Arbiter".

- [ ] **Step 6: Full grep verification**

Run: `grep -rn "guardian" src/`
Expected: No matches (except possibly comments referencing the rename)

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "refactor: rename guardian to arbiter in TypeScript frontend"
```

### Task 4: Build verification

- [ ] **Step 1: Verify Rust builds**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 2: Verify TypeScript builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Builds without errors

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues from guardian to arbiter rename"
```

---

## Chunk 2: SQLite Foundation

### Task 5: Add rusqlite dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add rusqlite to Cargo.toml**

Add under `[dependencies]`:
```toml
rusqlite = { version = "0.32", features = ["bundled", "fts5"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: Compiles (may take time for bundled SQLite build)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "deps: add rusqlite with bundled SQLite and FTS5"
```

### Task 6: Create database initialization module

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/init.rs`

- [ ] **Step 1: Create db module**

Create `src-tauri/src/db/mod.rs`:
```rust
pub mod init;
pub mod projects;
pub mod settings;
pub mod sessions;
pub mod notes;
pub mod bugs;
pub mod context;
pub mod memory;
pub mod arbiter_state;
pub mod stories;
```

- [ ] **Step 2: Create init.rs with schema**

Create `src-tauri/src/db/init.rs`:
```rust
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub type DbPool = Arc<Mutex<Connection>>;

pub fn db_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("ove.db")
}

pub fn init_db(app_data_dir: &PathBuf) -> Result<DbPool, String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let path = db_path(app_data_dir);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;

    create_tables(&conn).map_err(|e| e.to_string())?;

    Ok(Arc::new(Mutex::new(conn)))
}

fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    git_enabled INTEGER NOT NULL DEFAULT 0,
    arbiter_enabled INTEGER NOT NULL DEFAULT 0,
    arbiter_agent_type TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    yolo_mode INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    initial_prompt TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS context_units (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    tags_json TEXT DEFAULT '[]',
    l0_summary TEXT,
    l1_overview TEXT,
    l2_content TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_assignments (
    context_unit_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    PRIMARY KEY (context_unit_id, session_id),
    FOREIGN KEY (context_unit_id) REFERENCES context_units(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS context_defaults (
    context_unit_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    PRIMARY KEY (context_unit_id, project_id),
    FOREIGN KEY (context_unit_id) REFERENCES context_units(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    include_in_context INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS memories (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL,
    session_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    content TEXT NOT NULL,
    summary TEXT,
    entities_json TEXT DEFAULT '[]',
    topics_json TEXT DEFAULT '[]',
    importance REAL NOT NULL DEFAULT 0.5,
    consolidated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS consolidations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_ids_json TEXT NOT NULL,
    summary TEXT NOT NULL,
    insight TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS arbiter_state (
    project_id TEXT PRIMARY KEY,
    trust_level INTEGER NOT NULL DEFAULT 2,
    loop_status TEXT NOT NULL DEFAULT 'idle',
    current_story_id TEXT,
    iteration_count INTEGER NOT NULL DEFAULT 0,
    max_iterations INTEGER NOT NULL DEFAULT 50,
    last_activity_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    depends_on_json TEXT DEFAULT '[]',
    iteration_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS bug_configs (
    project_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    auth_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS context_units_fts USING fts5(
    name, l0_summary, l1_overview, l2_content,
    content=context_units, content_rowid=rid
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content, summary,
    content=memories, content_rowid=rid
);

CREATE VIRTUAL TABLE IF NOT EXISTS consolidations_fts USING fts5(
    summary, insight,
    content=consolidations
);
"#;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: Compiles

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/
git commit -m "feat: add SQLite database initialization with full schema"
```

### Task 7: Create project database operations

**Files:**
- Create: `src-tauri/src/db/projects.rs`

- [ ] **Step 1: Implement project CRUD**

Create `src-tauri/src/db/projects.rs` with functions:
- `list_projects(conn: &Connection) -> Result<Vec<Project>>` — SELECT all from projects
- `insert_project(conn: &Connection, project: &Project) -> Result<()>` — INSERT
- `update_project(conn: &Connection, project: &Project) -> Result<()>` — UPDATE by id
- `delete_project(conn: &Connection, id: &str) -> Result<()>` — DELETE by id
- `load_projects_sync(conn: &Connection) -> Vec<Project>` — for app startup

Each function uses `rusqlite::params![]` for parameterized queries.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/projects.rs
git commit -m "feat: add SQLite project CRUD operations"
```

### Task 8: Create settings database operations

**Files:**
- Create: `src-tauri/src/db/settings.rs`

- [ ] **Step 1: Implement settings CRUD**

Create `src-tauri/src/db/settings.rs` with functions:
- `get_setting(conn: &Connection, key: &str) -> Result<Option<String>>` — SELECT value_json by key
- `set_setting(conn: &Connection, key: &str, value_json: &str) -> Result<()>` — INSERT OR REPLACE
- `load_app_settings(conn: &Connection) -> AppSettings` — load full settings from multiple keys, return defaults for missing
- `save_app_settings(conn: &Connection, settings: &AppSettings) -> Result<()>` — save all settings keys

Settings are stored as individual key-value pairs. Keys: `global.theme`, `global.font_family`, `agents.claude`, etc. Or as two top-level keys: `global` and `agents` with JSON values.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/settings.rs
git commit -m "feat: add SQLite settings CRUD operations"
```

### Task 9: Create sessions database operations

**Files:**
- Create: `src-tauri/src/db/sessions.rs`

- [ ] **Step 1: Implement sessions CRUD**

Create `src-tauri/src/db/sessions.rs` with functions:
- `load_sessions(conn: &Connection) -> Result<Vec<PersistedSession>>` — SELECT all
- `save_sessions(conn: &Connection, sessions: &[PersistedSession]) -> Result<()>` — DELETE all then INSERT batch (matches current behavior)

Note: The existing PersistedSession struct in `state.rs` needs `initial_prompt: Option<String>` added.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/sessions.rs
git commit -m "feat: add SQLite session persistence operations"
```

### Task 10: Create notes database operations

**Files:**
- Create: `src-tauri/src/db/notes.rs`

- [ ] **Step 1: Implement notes CRUD**

Create `src-tauri/src/db/notes.rs` with functions:
- `list_notes(conn: &Connection, project_id: &str) -> Result<Vec<Note>>`
- `create_note(conn: &Connection, note: &Note) -> Result<()>`
- `read_note(conn: &Connection, project_id: &str, note_id: &str) -> Result<Note>`
- `update_note(conn: &Connection, note_id: &str, title: &str, content: &str) -> Result<()>`
- `delete_note(conn: &Connection, project_id: &str, note_id: &str) -> Result<()>`
- `set_include_in_context(conn: &Connection, note_id: &str, include: bool) -> Result<()>`

Note struct replaces ProjectNote: `{ id, project_id, title, content, include_in_context, created_at, updated_at }`.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/notes.rs
git commit -m "feat: add SQLite notes CRUD operations"
```

### Task 11: Create bug config database operations

**Files:**
- Create: `src-tauri/src/db/bugs.rs`

- [ ] **Step 1: Implement bug config CRUD**

Create `src-tauri/src/db/bugs.rs` with functions:
- `load_bug_config(conn: &Connection, project_id: &str) -> Result<Option<BugConfig>>`
- `save_bug_config(conn: &Connection, config: &BugConfig) -> Result<()>`
- `save_bug_auth(conn: &Connection, project_id: &str, auth_json: &str) -> Result<()>`
- `load_bug_auth(conn: &Connection, project_id: &str) -> Result<Option<String>>`
- `delete_bug_data(conn: &Connection, project_id: &str) -> Result<()>`

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/bugs.rs
git commit -m "feat: add SQLite bug config CRUD operations"
```

### Task 12: Create stub modules for future plans

**Files:**
- Create: `src-tauri/src/db/context.rs`
- Create: `src-tauri/src/db/memory.rs`
- Create: `src-tauri/src/db/arbiter_state.rs`
- Create: `src-tauri/src/db/stories.rs`

- [ ] **Step 1: Create stub files**

Each file contains a comment and empty module:
```rust
// Context Store operations — implemented in Plan 2
```
```rust
// Agent Memory operations — implemented in Plan 3
```
```rust
// Arbiter state operations — implemented in Plan 4
```
```rust
// Story/PRD operations — implemented in Plan 5
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/db/context.rs src-tauri/src/db/memory.rs src-tauri/src/db/arbiter_state.rs src-tauri/src/db/stories.rs
git commit -m "feat: add stub db modules for context, memory, arbiter_state, stories"
```

---

## Chunk 3: Wire SQLite Into Application

### Task 13: Update AppState to use SQLite

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add DbPool to AppState**

In `src-tauri/src/state.rs`, add:
```rust
use crate::db::init::DbPool;

pub struct AppState {
    pub db: DbPool,
    pub pty_manager: Arc<RwLock<PtyManager>>,
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub notification_tx: tokio::sync::mpsc::Sender<NotificationEvent>,
}
```

- [ ] **Step 2: Add PersistedSession.initial_prompt field**

In `src-tauri/src/state.rs` (or wherever PersistedSession is defined), add:
```rust
pub initial_prompt: Option<String>,
```

- [ ] **Step 3: Replace Note type**

Replace `ProjectNote` with a new `Note` struct:
```rust
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub include_in_context: bool,
    pub created_at: String,
    pub updated_at: String,
}
```

- [ ] **Step 4: Update lib.rs initialization**

In `src-tauri/src/lib.rs`, replace the JSON loading with SQLite init:
```rust
use crate::db::init::init_db;

// In setup:
let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
let db = init_db(&app_data_dir)?;

// Load initial data from SQLite
let projects = {
    let conn = db.lock().unwrap();
    crate::db::projects::load_projects_sync(&conn)
};
let settings = {
    let conn = db.lock().unwrap();
    crate::db::settings::load_app_settings(&conn)
};

let state = AppState {
    db: db.clone(),
    pty_manager: Arc::new(RwLock::new(PtyManager::new())),
    projects: Arc::new(RwLock::new(projects)),
    settings: Arc::new(RwLock::new(settings)),
    notification_tx: tx,
};
```

- [ ] **Step 5: Register db module in lib.rs**

Add `mod db;` to the module declarations at the top of `lib.rs`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat: wire SQLite DbPool into AppState and app initialization"
```

### Task 14: Rewrite project commands to use SQLite

**Files:**
- Modify: `src-tauri/src/commands/project_commands.rs`

- [ ] **Step 1: Replace all JSON file I/O with db calls**

Rewrite each command handler:
- `list_projects` → `db::projects::list_projects(&conn)`
- `add_project` → `db::projects::insert_project(&conn, &project)`
- `remove_project` → `db::projects::delete_project(&conn, &id)`
- `update_project` → `db::projects::update_project(&conn, &project)`

Remove `projects_path()`, `load_projects_from_disk()`, `save_projects_to_disk()`, `load_projects_sync()`.

Access db via `state.db.lock().unwrap()`.

- [ ] **Step 2: Keep arbiter_review function unchanged**

The `arbiter_review` function (formerly `guardian_review`) spawns CLI processes and doesn't touch storage. Leave it as-is (already renamed in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/project_commands.rs
git commit -m "refactor: rewrite project commands to use SQLite"
```

### Task 15: Rewrite settings commands to use SQLite

**Files:**
- Modify: `src-tauri/src/commands/settings_commands.rs`

- [ ] **Step 1: Replace JSON I/O with db calls**

- `get_settings` → read from AppState (already in memory), no change needed
- `update_settings` → `db::settings::save_app_settings(&conn, &settings)` then update AppState

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/commands/settings_commands.rs
git commit -m "refactor: rewrite settings commands to use SQLite"
```

### Task 16: Rewrite session commands to use SQLite

**Files:**
- Modify: `src-tauri/src/commands/session_commands.rs`

- [ ] **Step 1: Replace JSON I/O with db calls**

- `save_sessions` → `db::sessions::save_sessions(&conn, &sessions)`
- `load_sessions` → `db::sessions::load_sessions(&conn)`

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/commands/session_commands.rs
git commit -m "refactor: rewrite session commands to use SQLite"
```

### Task 17: Rewrite notes commands to use SQLite

**Files:**
- Modify: `src-tauri/src/commands/notes_commands.rs`

- [ ] **Step 1: Replace file-based I/O with db calls**

- `list_notes` → `db::notes::list_notes(&conn, &project_id)`
- `create_note` → `db::notes::create_note(&conn, &note)`
- `read_note_content` → `db::notes::read_note(&conn, &project_id, &note_id)`
- `update_note` → `db::notes::update_note(&conn, &note_id, &title, &content)`
- `delete_note` → `db::notes::delete_note(&conn, &project_id, &note_id)`

Add new command for the `include_in_context` toggle:
```rust
#[tauri::command]
pub async fn set_note_context_toggle(
    state: tauri::State<'_, AppState>,
    project_id: String,
    note_id: String,
    include: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::notes::set_include_in_context(&conn, &note_id, include)
        .map_err(|e| e.to_string())
}
```

Register the new command in `lib.rs`.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/commands/notes_commands.rs src-tauri/src/lib.rs
git commit -m "refactor: rewrite notes commands to use SQLite with context toggle"
```

### Task 18: Rewrite bug commands to use SQLite

**Files:**
- Modify: `src-tauri/src/commands/bugs_commands.rs`

- [ ] **Step 1: Replace file-based store calls with db calls**

Update store calls in each command handler:
- `get_bug_provider_config` → `db::bugs::load_bug_config(&conn, &project_id)`
- `save_bug_provider_config` → `db::bugs::save_bug_config(&conn, &config)`
- `check_bug_auth` → `db::bugs::load_bug_auth(&conn, &project_id).is_some()`
- `disconnect_bug_provider` → `db::bugs::delete_bug_data(&conn, &project_id)`

The OAuth flow stores auth: `db::bugs::save_bug_auth(&conn, &project_id, &auth_json)`.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/commands/bugs_commands.rs
git commit -m "refactor: rewrite bug commands to use SQLite"
```

### Task 19: Remove old file-based store modules

**Files:**
- Delete: `src-tauri/src/knowledge/store.rs`
- Delete: `src-tauri/src/knowledge/mod.rs`
- Delete: `src-tauri/src/notes/store.rs`
- Delete: `src-tauri/src/notes/mod.rs`
- Delete: `src-tauri/src/sessions/store.rs`
- Delete: `src-tauri/src/sessions/mod.rs`
- Delete: `src-tauri/src/settings/store.rs`
- Delete: `src-tauri/src/settings/mod.rs`
- Modify: `src-tauri/src/lib.rs` — remove old module declarations
- Modify: `src-tauri/src/commands/mod.rs` — remove knowledge_commands

- [ ] **Step 1: Remove old modules and update imports**

Delete the files listed above. In `lib.rs`, remove:
```rust
mod knowledge;
mod notes;
mod sessions;
mod settings;
```

Remove `knowledge_commands` from `commands/mod.rs` and from the `generate_handler!` macro in `lib.rs`.

Keep the `bugs/` module (provider.rs, oauth.rs, jira.rs, github.rs, youtrack.rs) as they contain API logic not storage. Only the `bugs/store.rs` file is no longer imported (its functions replaced by `db::bugs`).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove old JSON file-based store modules"
```

### Task 20: Update TypeScript types and IPC bridge

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Update types**

In `src/types/index.ts`:
- Remove `KnowledgeType` and `KnowledgeEntry` (replaced by context system in Plan 2)
- Update `ProjectNote` to `Note` with new fields:
```typescript
export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;
  include_in_context: boolean;
  created_at: string;
  updated_at: string;
}
```
- Add `initial_prompt?: string` to `PersistedSession`

- [ ] **Step 2: Update IPC bridge**

In `src/lib/tauri.ts`:
- Remove all knowledge-related functions (`listKnowledge`, `createKnowledge`, `readKnowledgeContent`, `updateKnowledge`, `deleteKnowledge`)
- Update note functions to match new signatures (content returned inline, not via file read)
- Add `setNoteContextToggle(projectId: string, noteId: string, include: boolean)`
- Verify `arbiterReview` function name matches the renamed Rust command

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/tauri.ts
git commit -m "refactor: update TypeScript types and IPC bridge for SQLite migration"
```

### Task 21: Update frontend components

**Files:**
- Modify: `src/features/knowledge/components/KnowledgePanel.tsx` — temporarily stub out or redirect
- Modify: `src/features/notes/components/NotesPanel.tsx` — update for inline content + context toggle
- Modify: `src/lib/arbiter.ts` — remove knowledge-based "Arbiter Notes" logic

- [ ] **Step 1: Stub KnowledgePanel**

The Knowledge panel is being replaced by the Context panel in Plan 2. For now, render a placeholder message: "Context panel coming soon" or hide the panel tab entirely.

- [ ] **Step 2: Update NotesPanel for inline content**

Update `NotesPanel.tsx` to use the new `Note` interface (content is inline, not fetched via `readNoteContent`). Add a toggle switch for `include_in_context` per note that calls `setNoteContextToggle`.

- [ ] **Step 3: Update arbiter.ts**

Remove the logic that reads/creates "Arbiter Notes" from the knowledge system. The Arbiter will use the context store in Plan 2 and memory system in Plan 3. For now, the Arbiter works without project notes (it still answers questions based on terminal output and options).

- [ ] **Step 4: Commit**

```bash
git add src/features/ src/lib/arbiter.ts
git commit -m "refactor: update frontend for SQLite migration, stub knowledge panel"
```

### Task 22: Update .gitignore and final build verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add SQLite database to .gitignore**

Add to `.gitignore`:
```
# SQLite database (contains personal data)
*.db
*.db-wal
*.db-shm
```

- [ ] **Step 2: Full build verification**

Run: `cd src-tauri && cargo build 2>&1 | tail -10`
Expected: Compiles without errors

Run: `npm run build 2>&1 | tail -10`
Expected: Builds without errors

- [ ] **Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: add SQLite database files to .gitignore"
```

---

## Verification Checklist

- [ ] `grep -rn "guardian" src-tauri/src/ src/` returns no matches
- [ ] `cargo build` succeeds
- [ ] `npm run build` succeeds
- [ ] App starts and creates `ove.db` in the data directory
- [ ] No JSON files are read/written for projects, settings, sessions, notes, or bugs
- [ ] Old JSON files in data directory are ignored (not migrated, not deleted)
