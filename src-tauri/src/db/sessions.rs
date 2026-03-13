use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: String,
    pub project_id: String,
    pub agent_type: String,
    pub yolo_mode: bool,
    pub label: String,
    pub initial_prompt: Option<String>,
    pub created_at: String,
}

pub fn load_sessions(conn: &Connection) -> Result<Vec<PersistedSession>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, agent_type, yolo_mode, label, initial_prompt, created_at FROM sessions",
    )?;
    let rows = stmt.query_map(params![], |row| {
        Ok(PersistedSession {
            id: row.get(0)?,
            project_id: row.get(1)?,
            agent_type: row.get(2)?,
            yolo_mode: row.get(3)?,
            label: row.get(4)?,
            initial_prompt: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row?);
    }
    Ok(sessions)
}

pub fn save_sessions(conn: &Connection, sessions: &[PersistedSession]) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM sessions", params![])?;

    let mut stmt = conn.prepare(
        "INSERT INTO sessions (id, project_id, agent_type, yolo_mode, label, initial_prompt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?;

    for session in sessions {
        stmt.execute(params![
            session.id,
            session.project_id,
            session.agent_type,
            session.yolo_mode,
            session.label,
            session.initial_prompt,
            session.created_at,
        ])?;
    }

    Ok(())
}
