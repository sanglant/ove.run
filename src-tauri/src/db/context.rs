use crate::state::ContextUnit;
use rusqlite::{params, Connection};

fn row_to_context_unit(row: &rusqlite::Row) -> Result<ContextUnit, rusqlite::Error> {
    Ok(ContextUnit {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        name: row.get("name")?,
        unit_type: row.get::<_, String>("type")?,
        scope: row.get("scope")?,
        tags_json: row.get("tags_json")?,
        l0_summary: row.get("l0_summary")?,
        l1_overview: row.get("l1_overview")?,
        l2_content: row.get("l2_content")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        is_bundled: row.get::<_, i32>("is_bundled").unwrap_or(0) != 0,
        bundled_slug: row.get("bundled_slug").ok(),
    })
}

// --- FTS5 sync helpers ---

fn sync_fts_insert(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    let rid: i64 = conn.query_row(
        "SELECT rid FROM context_units WHERE id = ?1",
        params![unit.id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO context_units_fts(rowid, name, l0_summary, l1_overview, l2_content) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![rid, unit.name, unit.l0_summary, unit.l1_overview, unit.l2_content],
    )?;
    Ok(())
}

fn sync_fts_delete(conn: &Connection, rid: i64, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO context_units_fts(context_units_fts, rowid, name, l0_summary, l1_overview, l2_content) VALUES('delete', ?1, ?2, ?3, ?4, ?5)",
        params![rid, unit.name, unit.l0_summary, unit.l1_overview, unit.l2_content],
    )?;
    Ok(())
}

// --- Core CRUD ---

pub fn list_context_units(
    conn: &Connection,
    project_id: Option<&str>,
) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    let mut units = Vec::new();
    match project_id {
        Some(pid) => {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, name, type, scope, tags_json, l0_summary, l1_overview, l2_content, created_at, updated_at, is_bundled, bundled_slug \
                 FROM context_units WHERE project_id = ?1 OR project_id IS NULL ORDER BY updated_at DESC"
            )?;
            let rows = stmt.query_map(params![pid], row_to_context_unit)?;
            for row in rows {
                units.push(row?);
            }
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, name, type, scope, tags_json, l0_summary, l1_overview, l2_content, created_at, updated_at, is_bundled, bundled_slug \
                 FROM context_units WHERE project_id IS NULL ORDER BY updated_at DESC"
            )?;
            let rows = stmt.query_map([], row_to_context_unit)?;
            for row in rows {
                units.push(row?);
            }
        }
    }
    Ok(units)
}

pub fn get_context_unit(conn: &Connection, id: &str) -> Result<ContextUnit, rusqlite::Error> {
    conn.query_row(
        "SELECT id, project_id, name, type, scope, tags_json, l0_summary, l1_overview, l2_content, created_at, updated_at, is_bundled, bundled_slug \
         FROM context_units WHERE id = ?1",
        params![id],
        row_to_context_unit,
    )
}

pub fn create_context_unit(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO context_units (id, project_id, name, type, scope, tags_json, l0_summary, l1_overview, l2_content, created_at, updated_at, is_bundled, bundled_slug) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            unit.id,
            unit.project_id,
            unit.name,
            unit.unit_type,
            unit.scope,
            unit.tags_json,
            unit.l0_summary,
            unit.l1_overview,
            unit.l2_content,
            unit.created_at,
            unit.updated_at,
            unit.is_bundled as i32,
            unit.bundled_slug,
        ],
    )?;
    sync_fts_insert(conn, unit)?;
    Ok(())
}

pub fn update_context_unit(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    // Get current rid and data for FTS delete
    let (rid, old_unit) = {
        let old = get_context_unit(conn, &unit.id)?;
        let rid: i64 = conn.query_row(
            "SELECT rid FROM context_units WHERE id = ?1",
            params![unit.id],
            |row| row.get(0),
        )?;
        (rid, old)
    };

    // Delete old FTS entry
    sync_fts_delete(conn, rid, &old_unit)?;

    // Update the row
    conn.execute(
        "UPDATE context_units SET project_id = ?1, name = ?2, type = ?3, scope = ?4, tags_json = ?5, \
         l0_summary = ?6, l1_overview = ?7, l2_content = ?8, updated_at = ?9 WHERE id = ?10",
        params![
            unit.project_id,
            unit.name,
            unit.unit_type,
            unit.scope,
            unit.tags_json,
            unit.l0_summary,
            unit.l1_overview,
            unit.l2_content,
            unit.updated_at,
            unit.id,
        ],
    )?;

    // Insert new FTS entry
    sync_fts_insert(conn, unit)?;
    Ok(())
}

pub fn delete_context_unit(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    let unit = get_context_unit(conn, id)?;
    let rid: i64 = conn.query_row(
        "SELECT rid FROM context_units WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;

    // SAFETY: unchecked_transaction does not require &mut Connection.
    // The transaction is rolled back automatically on drop if commit() is not called.
    let tx = conn.unchecked_transaction()?;

    // Delete assignments and defaults first
    tx.execute(
        "DELETE FROM context_assignments WHERE context_unit_id = ?1",
        params![id],
    )?;
    tx.execute(
        "DELETE FROM context_defaults WHERE context_unit_id = ?1",
        params![id],
    )?;

    // Delete FTS entry
    sync_fts_delete(&tx, rid, &unit)?;

    // Delete the row
    tx.execute("DELETE FROM context_units WHERE id = ?1", params![id])?;

    tx.commit()?;
    Ok(())
}

pub fn search_context_units(
    conn: &Connection,
    query: &str,
    project_id: Option<&str>,
) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    let safe_query = format!("\"{}\"", query.replace('"', "\"\""));
    let mut units = Vec::new();
    match project_id {
        Some(pid) => {
            let mut stmt = conn.prepare(
                "SELECT cu.id, cu.project_id, cu.name, cu.type, cu.scope, cu.tags_json, \
                 cu.l0_summary, cu.l1_overview, cu.l2_content, cu.created_at, cu.updated_at, cu.is_bundled, cu.bundled_slug \
                 FROM context_units cu \
                 JOIN context_units_fts fts ON cu.rid = fts.rowid \
                 WHERE context_units_fts MATCH ?1 AND (cu.project_id = ?2 OR cu.project_id IS NULL) \
                 ORDER BY rank"
            )?;
            let rows = stmt.query_map(params![safe_query, pid], row_to_context_unit)?;
            for row in rows {
                units.push(row?);
            }
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT cu.id, cu.project_id, cu.name, cu.type, cu.scope, cu.tags_json, \
                 cu.l0_summary, cu.l1_overview, cu.l2_content, cu.created_at, cu.updated_at, cu.is_bundled, cu.bundled_slug \
                 FROM context_units cu \
                 JOIN context_units_fts fts ON cu.rid = fts.rowid \
                 WHERE context_units_fts MATCH ?1 AND cu.project_id IS NULL \
                 ORDER BY rank"
            )?;
            let rows = stmt.query_map(params![safe_query], row_to_context_unit)?;
            for row in rows {
                units.push(row?);
            }
        }
    }
    Ok(units)
}

pub fn list_l0_summaries(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<(String, String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, l0_summary FROM context_units \
         WHERE (project_id = ?1 OR (project_id IS NULL AND is_bundled = 0)) AND l0_summary IS NOT NULL \
         ORDER BY updated_at DESC"
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

// --- Context assignment functions ---

pub fn assign_context_to_session(
    conn: &Connection,
    unit_id: &str,
    session_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO context_assignments (context_unit_id, session_id, assigned_at) VALUES (?1, ?2, ?3)",
        params![unit_id, session_id, chrono::Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

pub fn unassign_context_from_session(
    conn: &Connection,
    unit_id: &str,
    session_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM context_assignments WHERE context_unit_id = ?1 AND session_id = ?2",
        params![unit_id, session_id],
    )?;
    Ok(())
}

pub fn list_session_context(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT cu.id, cu.project_id, cu.name, cu.type, cu.scope, cu.tags_json, \
         cu.l0_summary, cu.l1_overview, cu.l2_content, cu.created_at, cu.updated_at, cu.is_bundled, cu.bundled_slug \
         FROM context_units cu \
         JOIN context_assignments ca ON cu.id = ca.context_unit_id \
         WHERE ca.session_id = ?1 \
         ORDER BY ca.assigned_at DESC"
    )?;
    let rows = stmt.query_map(params![session_id], row_to_context_unit)?;
    let mut units = Vec::new();
    for row in rows {
        units.push(row?);
    }
    Ok(units)
}

pub fn set_project_default(
    conn: &Connection,
    unit_id: &str,
    project_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO context_defaults (context_unit_id, project_id) VALUES (?1, ?2)",
        params![unit_id, project_id],
    )?;
    Ok(())
}

pub fn remove_project_default(
    conn: &Connection,
    unit_id: &str,
    project_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM context_defaults WHERE context_unit_id = ?1 AND project_id = ?2",
        params![unit_id, project_id],
    )?;
    Ok(())
}

pub fn list_project_defaults(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT cu.id, cu.project_id, cu.name, cu.type, cu.scope, cu.tags_json, \
         cu.l0_summary, cu.l1_overview, cu.l2_content, cu.created_at, cu.updated_at, cu.is_bundled, cu.bundled_slug \
         FROM context_units cu \
         JOIN context_defaults cd ON cu.id = cd.context_unit_id \
         WHERE cd.project_id = ?1 \
         ORDER BY cu.updated_at DESC"
    )?;
    let rows = stmt.query_map(params![project_id], row_to_context_unit)?;
    let mut units = Vec::new();
    for row in rows {
        units.push(row?);
    }
    Ok(units)
}

pub fn copy_defaults_to_session(
    conn: &Connection,
    project_id: &str,
    session_id: &str,
) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO context_assignments (context_unit_id, session_id, assigned_at) \
         SELECT context_unit_id, ?1, ?2 FROM context_defaults WHERE project_id = ?3",
        params![session_id, now, project_id],
    )?;
    Ok(())
}

/// Upsert a bundled context unit by its slug.
pub fn upsert_bundled_unit(
    conn: &Connection,
    unit: &ContextUnit,
    slug: &str,
) -> Result<(), rusqlite::Error> {
    use rusqlite::OptionalExtension;
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM context_units WHERE bundled_slug = ?1",
            params![slug],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(id) = existing_id {
        // Fetch the old row and its rid before modifying so we can remove the
        // stale FTS entry, then insert a fresh one after the UPDATE.
        let (rid, old_unit) = {
            let old = get_context_unit(conn, &id)?;
            let rid: i64 = conn.query_row(
                "SELECT rid FROM context_units WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )?;
            (rid, old)
        };

        // SAFETY: unchecked_transaction does not require &mut Connection.
        // The transaction is rolled back automatically on drop if commit() is not called.
        let tx = conn.unchecked_transaction()?;

        sync_fts_delete(&tx, rid, &old_unit)?;

        tx.execute(
            "UPDATE context_units SET name = ?1, type = ?2, l0_summary = ?3, l1_overview = ?4, \
             l2_content = ?5, is_bundled = 1, updated_at = ?6 WHERE id = ?7",
            params![
                unit.name,
                unit.unit_type,
                unit.l0_summary,
                unit.l1_overview,
                unit.l2_content,
                unit.updated_at,
                id,
            ],
        )?;

        // Build the updated unit so sync_fts_insert can look it up by id.
        // The id comes from the existing row; all other searchable fields come
        // from the incoming `unit`.
        let updated_unit = crate::state::ContextUnit {
            id: id.clone(),
            ..unit.clone()
        };
        sync_fts_insert(&tx, &updated_unit)?;

        tx.commit()?;
    } else {
        conn.execute(
            "INSERT INTO context_units (id, project_id, name, type, scope, tags_json, l0_summary, \
             l1_overview, l2_content, is_bundled, bundled_slug, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?11, ?12)",
            params![
                unit.id,
                unit.project_id,
                unit.name,
                unit.unit_type,
                unit.scope,
                unit.tags_json,
                unit.l0_summary,
                unit.l1_overview,
                unit.l2_content,
                slug,
                unit.created_at,
                unit.updated_at,
            ],
        )?;
        sync_fts_insert(conn, unit)?;
    }
    Ok(())
}
