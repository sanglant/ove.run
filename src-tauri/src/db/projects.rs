use rusqlite::{params, Connection};

use crate::state::{Memory, Project, ContextUnit};

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, created_at, git_enabled, arbiter_enabled, arbiter_agent_type FROM projects",
    )?;
    let rows = stmt.query_map(params![], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            git_enabled: row.get(4)?,
            arbiter_enabled: row.get(5)?,
            arbiter_agent_type: row.get(6)?,
        })
    })?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row?);
    }
    Ok(projects)
}

pub fn insert_project(conn: &Connection, project: &Project) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO projects (id, name, path, created_at, git_enabled, arbiter_enabled, arbiter_agent_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            project.id,
            project.name,
            project.path,
            project.created_at,
            project.git_enabled,
            project.arbiter_enabled,
            project.arbiter_agent_type,
        ],
    )?;
    Ok(())
}

pub fn update_project(conn: &Connection, project: &Project) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE projects SET name = ?1, path = ?2, git_enabled = ?3, arbiter_enabled = ?4, arbiter_agent_type = ?5 WHERE id = ?6",
        params![
            project.name,
            project.path,
            project.git_enabled,
            project.arbiter_enabled,
            project.arbiter_agent_type,
            project.id,
        ],
    )?;
    Ok(())
}

pub fn delete_project(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    // Collect memories for this project so their FTS entries can be removed.
    let memories_to_delete: Vec<(i64, Memory)> = {
        let mut stmt = conn.prepare(
            "SELECT rid, id, project_id, session_id, visibility, content, summary, \
             entities_json, topics_json, importance, consolidated, created_at \
             FROM memories WHERE project_id = ?1",
        )?;
        let rows = stmt.query_map(params![id], |row| {
            let rid: i64 = row.get(0)?;
            let consolidated_int: i64 = row.get(10)?;
            Ok((rid, Memory {
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
            }))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // Collect project-scoped context units so their FTS entries can be removed.
    let context_units_to_delete: Vec<(i64, ContextUnit)> = {
        let mut stmt = conn.prepare(
            "SELECT rid, id, project_id, name, type, scope, tags_json, \
             l0_summary, l1_overview, l2_content, created_at, updated_at, is_bundled, bundled_slug \
             FROM context_units WHERE project_id = ?1",
        )?;
        let rows = stmt.query_map(params![id], |row| {
            Ok((row.get::<_, i64>(0)?, ContextUnit {
                id: row.get(1)?,
                project_id: row.get(2)?,
                name: row.get(3)?,
                unit_type: row.get::<_, String>(4)?,
                scope: row.get(5)?,
                tags_json: row.get(6)?,
                l0_summary: row.get(7)?,
                l1_overview: row.get(8)?,
                l2_content: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                is_bundled: row.get::<_, i32>(12).unwrap_or(0) != 0,
                bundled_slug: row.get(13).ok(),
            }))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // Collect consolidation rowids for FTS cleanup (consolidations_fts uses implicit rowid).
    let consolidation_rowids: Vec<(i64, String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT rowid, summary, insight FROM consolidations WHERE project_id = ?1",
        )?;
        let rows = stmt.query_map(params![id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // SAFETY: unchecked_transaction does not require &mut Connection.
    // The transaction is rolled back automatically on drop if commit() is not called.
    let tx = conn.unchecked_transaction()?;

    // 1. context_assignments — via sessions that belong to the project
    tx.execute(
        "DELETE FROM context_assignments WHERE session_id IN \
         (SELECT id FROM sessions WHERE project_id = ?1)",
        params![id],
    )?;

    // 2. context_defaults — for this project
    tx.execute("DELETE FROM context_defaults WHERE project_id = ?1", params![id])?;

    // 3. sessions — for this project
    tx.execute("DELETE FROM sessions WHERE project_id = ?1", params![id])?;

    // 4. notes — for this project
    tx.execute("DELETE FROM notes WHERE project_id = ?1", params![id])?;

    // 5. memories — FTS sync per row, then bulk delete
    for (rid, memory) in &memories_to_delete {
        tx.execute(
            "INSERT INTO memories_fts(memories_fts, rowid, content, summary) \
             VALUES('delete', ?1, ?2, ?3)",
            params![rid, memory.content, memory.summary],
        )?;
    }
    tx.execute("DELETE FROM memories WHERE project_id = ?1", params![id])?;

    // 6. consolidations — FTS sync per row, then bulk delete
    for (rowid, summary, insight) in &consolidation_rowids {
        tx.execute(
            "INSERT INTO consolidations_fts(consolidations_fts, rowid, summary, insight) \
             VALUES('delete', ?1, ?2, ?3)",
            params![rowid, summary, insight],
        )?;
    }
    tx.execute("DELETE FROM consolidations WHERE project_id = ?1", params![id])?;

    // 7. stories — for this project
    tx.execute("DELETE FROM stories WHERE project_id = ?1", params![id])?;

    // 8. arbiter_state — for this project
    tx.execute("DELETE FROM arbiter_state WHERE project_id = ?1", params![id])?;

    // 9. bug_configs — for this project
    tx.execute("DELETE FROM bug_configs WHERE project_id = ?1", params![id])?;

    // 10. project-scoped context units — FTS sync per row, then bulk delete
    for (rid, unit) in &context_units_to_delete {
        tx.execute(
            "INSERT INTO context_units_fts(context_units_fts, rowid, name, l0_summary, l1_overview, l2_content) \
             VALUES('delete', ?1, ?2, ?3, ?4, ?5)",
            params![rid, unit.name, unit.l0_summary, unit.l1_overview, unit.l2_content],
        )?;
    }
    tx.execute("DELETE FROM context_units WHERE project_id = ?1", params![id])?;

    // 11. Finally, the project itself
    tx.execute("DELETE FROM projects WHERE id = ?1", params![id])?;

    tx.commit()?;
    Ok(())
}

pub fn load_projects_sync(conn: &Connection) -> Vec<Project> {
    list_projects(conn).unwrap_or_default()
}
