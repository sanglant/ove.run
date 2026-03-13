use rusqlite::{Connection, params};
use crate::state::{ArbiterStateRow, TrustLevel};

pub fn get_arbiter_state(conn: &Connection, project_id: &str) -> Result<Option<ArbiterStateRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT project_id, trust_level, loop_status, current_story_id, \
         iteration_count, max_iterations, last_activity_at \
         FROM arbiter_state WHERE project_id = ?1"
    )?;

    let mut rows = stmt.query(params![project_id])?;

    match rows.next()? {
        Some(row) => Ok(Some(ArbiterStateRow {
            project_id: row.get(0)?,
            trust_level: TrustLevel::from_i32(row.get::<_, i32>(1)?),
            loop_status: row.get(2)?,
            current_story_id: row.get(3)?,
            iteration_count: row.get(4)?,
            max_iterations: row.get(5)?,
            last_activity_at: row.get(6)?,
        })),
        None => Ok(None),
    }
}

pub fn upsert_arbiter_state(conn: &Connection, state: &ArbiterStateRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO arbiter_state \
         (project_id, trust_level, loop_status, current_story_id, iteration_count, max_iterations, last_activity_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            state.project_id,
            state.trust_level as i32,
            state.loop_status,
            state.current_story_id,
            state.iteration_count,
            state.max_iterations,
            state.last_activity_at,
        ],
    )?;
    Ok(())
}

pub fn set_trust_level(conn: &Connection, project_id: &str, level: TrustLevel) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET trust_level = ?1 WHERE project_id = ?2",
        params![level as i32, project_id],
    )?;
    Ok(())
}

pub fn set_loop_status(conn: &Connection, project_id: &str, status: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET loop_status = ?1 WHERE project_id = ?2",
        params![status, project_id],
    )?;
    Ok(())
}

pub fn set_current_story(conn: &Connection, project_id: &str, story_id: Option<&str>) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET current_story_id = ?1 WHERE project_id = ?2",
        params![story_id, project_id],
    )?;
    Ok(())
}

pub fn increment_iteration(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET iteration_count = iteration_count + 1 WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}

pub fn reset_loop(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET loop_status = 'idle', current_story_id = NULL, iteration_count = 0 \
         WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}

pub fn update_last_activity(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET last_activity_at = datetime('now') WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}
