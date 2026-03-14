use rusqlite::{params, Connection};
use crate::state::{Consolidation, Memory};

// --- Row helpers ---

fn row_to_memory(row: &rusqlite::Row) -> Result<Memory, rusqlite::Error> {
    let consolidated_int: i64 = row.get("consolidated")?;
    Ok(Memory {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        session_id: row.get("session_id")?,
        visibility: row.get("visibility")?,
        content: row.get("content")?,
        summary: row.get("summary")?,
        entities_json: row.get("entities_json")?,
        topics_json: row.get("topics_json")?,
        importance: row.get("importance")?,
        consolidated: consolidated_int != 0,
        created_at: row.get("created_at")?,
    })
}

fn row_to_consolidation(row: &rusqlite::Row) -> Result<Consolidation, rusqlite::Error> {
    Ok(Consolidation {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        source_ids_json: row.get("source_ids_json")?,
        summary: row.get("summary")?,
        insight: row.get("insight")?,
        created_at: row.get("created_at")?,
    })
}

// --- FTS5 sync helpers for memories ---

fn sync_memory_fts_insert(conn: &Connection, memory: &Memory) -> Result<(), rusqlite::Error> {
    let rid: i64 = conn.query_row(
        "SELECT rid FROM memories WHERE id = ?1",
        params![memory.id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO memories_fts(rowid, content, summary) VALUES (?1, ?2, ?3)",
        params![rid, memory.content, memory.summary],
    )?;
    Ok(())
}

fn sync_memory_fts_delete(conn: &Connection, rid: i64, memory: &Memory) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO memories_fts(memories_fts, rowid, content, summary) VALUES('delete', ?1, ?2, ?3)",
        params![rid, memory.content, memory.summary],
    )?;
    Ok(())
}

// --- FTS5 sync helpers for consolidations ---
// consolidations_fts has content=consolidations but no content_rowid, so it uses the
// implicit SQLite rowid of the consolidations table (not the id TEXT primary key).

fn sync_consolidation_fts_insert(conn: &Connection, consolidation: &Consolidation) -> Result<(), rusqlite::Error> {
    let rowid: i64 = conn.query_row(
        "SELECT rowid FROM consolidations WHERE id = ?1",
        params![consolidation.id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO consolidations_fts(rowid, summary, insight) VALUES (?1, ?2, ?3)",
        params![rowid, consolidation.summary, consolidation.insight],
    )?;
    Ok(())
}

fn sync_consolidation_fts_delete(conn: &Connection, consolidation: &Consolidation) -> Result<(), rusqlite::Error> {
    let rowid: i64 = conn.query_row(
        "SELECT rowid FROM consolidations WHERE id = ?1",
        params![consolidation.id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO consolidations_fts(consolidations_fts, rowid, summary, insight) VALUES('delete', ?1, ?2, ?3)",
        params![rowid, consolidation.summary, consolidation.insight],
    )?;
    Ok(())
}

// --- Memory CRUD ---

pub fn create_memory(conn: &Connection, memory: &Memory) -> Result<(), rusqlite::Error> {
    let consolidated_int: i64 = if memory.consolidated { 1 } else { 0 };
    conn.execute(
        "INSERT INTO memories (id, project_id, session_id, visibility, content, summary, \
         entities_json, topics_json, importance, consolidated, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            memory.id,
            memory.project_id,
            memory.session_id,
            memory.visibility,
            memory.content,
            memory.summary,
            memory.entities_json,
            memory.topics_json,
            memory.importance,
            consolidated_int,
            memory.created_at,
        ],
    )?;
    sync_memory_fts_insert(conn, memory)?;
    Ok(())
}

pub fn list_memories(
    conn: &Connection,
    project_id: &str,
    session_id: Option<&str>,
    visibility: Option<&str>,
) -> Result<Vec<Memory>, rusqlite::Error> {
    let mut memories = Vec::new();

    // Build query dynamically based on optional filters
    let base = "SELECT id, project_id, session_id, visibility, content, summary, \
                entities_json, topics_json, importance, consolidated, created_at \
                FROM memories WHERE project_id = ?1";

    match (session_id, visibility) {
        (Some(sid), Some(vis)) => {
            let mut stmt = conn.prepare(&format!(
                "{} AND session_id = ?2 AND visibility = ?3 ORDER BY created_at DESC", base
            ))?;
            let rows = stmt.query_map(params![project_id, sid, vis], |row| row_to_memory(row))?;
            for row in rows {
                memories.push(row?);
            }
        }
        (Some(sid), None) => {
            let mut stmt = conn.prepare(&format!(
                "{} AND session_id = ?2 ORDER BY created_at DESC", base
            ))?;
            let rows = stmt.query_map(params![project_id, sid], |row| row_to_memory(row))?;
            for row in rows {
                memories.push(row?);
            }
        }
        (None, Some(vis)) => {
            let mut stmt = conn.prepare(&format!(
                "{} AND visibility = ?2 ORDER BY created_at DESC", base
            ))?;
            let rows = stmt.query_map(params![project_id, vis], |row| row_to_memory(row))?;
            for row in rows {
                memories.push(row?);
            }
        }
        (None, None) => {
            let mut stmt = conn.prepare(&format!(
                "{} ORDER BY created_at DESC", base
            ))?;
            let rows = stmt.query_map(params![project_id], |row| row_to_memory(row))?;
            for row in rows {
                memories.push(row?);
            }
        }
    }

    Ok(memories)
}

pub fn get_memory(conn: &Connection, id: &str) -> Result<Memory, rusqlite::Error> {
    conn.query_row(
        "SELECT id, project_id, session_id, visibility, content, summary, \
         entities_json, topics_json, importance, consolidated, created_at \
         FROM memories WHERE id = ?1",
        params![id],
        |row| row_to_memory(row),
    )
}

pub fn update_memory_visibility(conn: &Connection, id: &str, visibility: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE memories SET visibility = ?1 WHERE id = ?2",
        params![visibility, id],
    )?;
    Ok(())
}

pub fn mark_memories_consolidated(conn: &Connection, ids: &[String]) -> Result<(), rusqlite::Error> {
    for id in ids {
        conn.execute(
            "UPDATE memories SET consolidated = 1 WHERE id = ?1",
            params![id],
        )?;
    }
    Ok(())
}

pub fn delete_memory(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    let memory = get_memory(conn, id)?;
    let rid: i64 = conn.query_row(
        "SELECT rid FROM memories WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    sync_memory_fts_delete(conn, rid, &memory)?;
    conn.execute("DELETE FROM memories WHERE id = ?1", params![id])?;
    Ok(())
}

/// Search memories using FTS5 with scored retrieval.
/// Effective importance = importance * max(0.0, 1.0 - days_since_creation / 90.0)
/// Consolidated memories are not decayed.
/// Results ordered by effective_importance DESC.
pub fn search_memories(
    conn: &Connection,
    query: &str,
    project_id: &str,
    session_id: Option<&str>,
    limit: usize,
) -> Result<Vec<Memory>, rusqlite::Error> {
    let mut memories = Vec::new();

    let base_sql = "SELECT m.id, m.project_id, m.session_id, m.visibility, m.content, m.summary, \
                    m.entities_json, m.topics_json, m.importance, m.consolidated, m.created_at, \
                    CASE WHEN m.consolidated = 1 THEN m.importance \
                         ELSE m.importance * MAX(0.0, 1.0 - \
                              (JULIANDAY('now') - JULIANDAY(m.created_at)) / 90.0) \
                    END AS effective_importance \
                    FROM memories m \
                    JOIN memories_fts fts ON m.rid = fts.rowid \
                    WHERE memories_fts MATCH ?1 AND m.project_id = ?2";

    match session_id {
        Some(sid) => {
            let sql = format!(
                "{} AND m.session_id = ?3 ORDER BY effective_importance DESC LIMIT ?4",
                base_sql
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![query, project_id, sid, limit as i64], |row| {
                row_to_memory(row)
            })?;
            for row in rows {
                memories.push(row?);
            }
        }
        None => {
            let sql = format!(
                "{} ORDER BY effective_importance DESC LIMIT ?3",
                base_sql
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![query, project_id, limit as i64], |row| {
                row_to_memory(row)
            })?;
            for row in rows {
                memories.push(row?);
            }
        }
    }

    Ok(memories)
}

/// Delete unconsolidated memories with effective_importance < 0.05
pub fn prune_decayed_memories(conn: &Connection, project_id: &str) -> Result<usize, rusqlite::Error> {
    // Collect memories that need to be pruned (FTS must be updated per row)
    let to_prune: Vec<(i64, Memory)> = {
        let mut stmt = conn.prepare(
            "SELECT rid, id, project_id, session_id, visibility, content, summary, \
             entities_json, topics_json, importance, consolidated, created_at \
             FROM memories \
             WHERE project_id = ?1 AND consolidated = 0 \
             AND (importance * MAX(0.0, 1.0 - (JULIANDAY('now') - JULIANDAY(created_at)) / 90.0)) < 0.05"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            let rid: i64 = row.get(0)?;
            // The rest of columns shifted by 1 (rid is col 0)
            let consolidated_int: i64 = row.get(10)?;
            let memory = Memory {
                id: row.get(1)?,
                project_id: row.get(2)?,
                session_id: row.get(3)?,
                visibility: row.get(4)?,
                content: row.get(5)?,
                summary: row.get(6)?,
                entities_json: row.get(7)?,
                topics_json: row.get(8)?,
                importance: row.get(9)?,
                consolidated: consolidated_int != 0,
                created_at: row.get(11)?,
            };
            Ok((rid, memory))
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        result
    };

    let count = to_prune.len();
    if count == 0 {
        return Ok(0);
    }

    // SAFETY: unchecked_transaction does not require &mut Connection.
    // The transaction is rolled back automatically on drop if commit() is not called.
    let tx = conn.unchecked_transaction()?;

    for (rid, memory) in &to_prune {
        sync_memory_fts_delete(&tx, *rid, memory)?;
        tx.execute("DELETE FROM memories WHERE id = ?1", params![memory.id])?;
    }

    tx.commit()?;
    Ok(count)
}

/// Get unconsolidated memories for a project, ordered by importance DESC.
pub fn get_unconsolidated_memories(conn: &Connection, project_id: &str, limit: usize) -> Result<Vec<Memory>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, session_id, visibility, content, summary, \
         entities_json, topics_json, importance, consolidated, created_at \
         FROM memories \
         WHERE project_id = ?1 AND consolidated = 0 \
         ORDER BY importance DESC \
         LIMIT ?2"
    )?;
    let rows = stmt.query_map(params![project_id, limit as i64], |row| row_to_memory(row))?;
    let mut memories = Vec::new();
    for row in rows {
        memories.push(row?);
    }
    Ok(memories)
}

/// Count unconsolidated memories for a project.
pub fn count_unconsolidated(conn: &Connection, project_id: &str) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM memories WHERE project_id = ?1 AND consolidated = 0",
        params![project_id],
        |row| row.get(0),
    )
}

// --- Consolidation CRUD ---

pub fn create_consolidation(conn: &Connection, consolidation: &Consolidation) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO consolidations (id, project_id, source_ids_json, summary, insight, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            consolidation.id,
            consolidation.project_id,
            consolidation.source_ids_json,
            consolidation.summary,
            consolidation.insight,
            consolidation.created_at,
        ],
    )?;
    sync_consolidation_fts_insert(conn, consolidation)?;
    Ok(())
}

pub fn list_consolidations(conn: &Connection, project_id: &str) -> Result<Vec<Consolidation>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, source_ids_json, summary, insight, created_at \
         FROM consolidations WHERE project_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map(params![project_id], |row| row_to_consolidation(row))?;
    let mut consolidations = Vec::new();
    for row in rows {
        consolidations.push(row?);
    }
    Ok(consolidations)
}

pub fn search_consolidations(
    conn: &Connection,
    query: &str,
    project_id: &str,
) -> Result<Vec<Consolidation>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.project_id, c.source_ids_json, c.summary, c.insight, c.created_at \
         FROM consolidations c \
         JOIN consolidations_fts fts ON c.rowid = fts.rowid \
         WHERE consolidations_fts MATCH ?1 AND c.project_id = ?2 \
         ORDER BY rank"
    )?;
    let rows = stmt.query_map(params![query, project_id], |row| row_to_consolidation(row))?;
    let mut consolidations = Vec::new();
    for row in rows {
        consolidations.push(row?);
    }
    Ok(consolidations)
}

pub fn delete_consolidation(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    let consolidation = conn.query_row(
        "SELECT id, project_id, source_ids_json, summary, insight, created_at \
         FROM consolidations WHERE id = ?1",
        params![id],
        |row| row_to_consolidation(row),
    )?;
    sync_consolidation_fts_delete(conn, &consolidation)?;
    conn.execute("DELETE FROM consolidations WHERE id = ?1", params![id])?;
    Ok(())
}
