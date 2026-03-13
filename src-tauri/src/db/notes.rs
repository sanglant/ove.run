use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub include_in_context: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_notes(conn: &Connection, project_id: &str) -> Result<Vec<Note>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, content, include_in_context, created_at, updated_at FROM notes WHERE project_id = ?1",
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(Note {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            content: row.get(3)?,
            include_in_context: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let mut notes = Vec::new();
    for row in rows {
        notes.push(row?);
    }
    Ok(notes)
}

pub fn create_note(conn: &Connection, note: &Note) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO notes (id, project_id, title, content, include_in_context, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            note.id,
            note.project_id,
            note.title,
            note.content,
            note.include_in_context,
            note.created_at,
            note.updated_at,
        ],
    )?;
    Ok(())
}

pub fn read_note(conn: &Connection, project_id: &str, note_id: &str) -> Result<Note, rusqlite::Error> {
    conn.query_row(
        "SELECT id, project_id, title, content, include_in_context, created_at, updated_at FROM notes WHERE id = ?1 AND project_id = ?2",
        params![note_id, project_id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                include_in_context: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
}

pub fn update_note(conn: &Connection, note_id: &str, title: &str, content: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![title, content, note_id],
    )?;
    Ok(())
}

pub fn delete_note(conn: &Connection, project_id: &str, note_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM notes WHERE id = ?1 AND project_id = ?2",
        params![note_id, project_id],
    )?;
    Ok(())
}

pub fn set_include_in_context(conn: &Connection, note_id: &str, include: bool) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE notes SET include_in_context = ?1 WHERE id = ?2",
        params![include, note_id],
    )?;
    Ok(())
}
