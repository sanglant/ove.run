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
    run_migrations(conn)?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Migration: reduce old default of 50 max_iterations to 10 for existing projects
    conn.execute(
        "UPDATE arbiter_state SET max_iterations = 10 WHERE max_iterations = 50",
        [],
    )?;
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
    max_iterations INTEGER NOT NULL DEFAULT 10,
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
