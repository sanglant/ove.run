use crate::state::{ArbiterStateRow, TrustLevel};
use rusqlite::{params, Connection};

pub fn get_arbiter_state(
    conn: &Connection,
    project_id: &str,
) -> Result<Option<ArbiterStateRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT project_id, trust_level, loop_status, current_story_id, \
         iteration_count, max_iterations, last_activity_at \
         FROM arbiter_state WHERE project_id = ?1",
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

pub fn upsert_arbiter_state(
    conn: &Connection,
    state: &ArbiterStateRow,
) -> Result<(), rusqlite::Error> {
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

pub fn set_trust_level(
    conn: &Connection,
    project_id: &str,
    level: TrustLevel,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET trust_level = ?1 WHERE project_id = ?2",
        params![level as i32, project_id],
    )?;
    Ok(())
}

pub fn set_loop_status(
    conn: &Connection,
    project_id: &str,
    status: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE arbiter_state SET loop_status = ?1 WHERE project_id = ?2",
        params![status, project_id],
    )?;
    Ok(())
}

pub fn set_current_story(
    conn: &Connection,
    project_id: &str,
    story_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS arbiter_state (
                project_id TEXT PRIMARY KEY,
                trust_level INTEGER NOT NULL DEFAULT 2,
                loop_status TEXT NOT NULL DEFAULT 'idle',
                current_story_id TEXT,
                iteration_count INTEGER NOT NULL DEFAULT 0,
                max_iterations INTEGER NOT NULL DEFAULT 10,
                last_activity_at TEXT
            );",
        )
        .unwrap();
        conn
    }

    fn make_state(project_id: &str) -> ArbiterStateRow {
        ArbiterStateRow {
            project_id: project_id.to_string(),
            trust_level: TrustLevel::Autonomous,
            loop_status: "idle".to_string(),
            current_story_id: None,
            iteration_count: 0,
            max_iterations: 10,
            last_activity_at: None,
        }
    }

    #[test]
    fn upsert_and_get_state() {
        let conn = test_db();
        let state = make_state("p1");
        upsert_arbiter_state(&conn, &state).unwrap();
        let fetched = get_arbiter_state(&conn, "p1").unwrap();
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.project_id, "p1");
        assert_eq!(fetched.trust_level, TrustLevel::Autonomous);
        assert_eq!(fetched.loop_status, "idle");
        assert_eq!(fetched.iteration_count, 0);
        assert_eq!(fetched.max_iterations, 10);
    }

    #[test]
    fn get_state_returns_none_for_missing() {
        let conn = test_db();
        let result = get_arbiter_state(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn set_loop_status_works() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        set_loop_status(&conn, "p1", "running").unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.loop_status, "running");
    }

    #[test]
    fn set_current_story_works() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        set_current_story(&conn, "p1", Some("story-123")).unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.current_story_id, Some("story-123".to_string()));

        set_current_story(&conn, "p1", None).unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.current_story_id, None);
    }

    #[test]
    fn increment_iteration_works() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        increment_iteration(&conn, "p1").unwrap();
        increment_iteration(&conn, "p1").unwrap();
        increment_iteration(&conn, "p1").unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.iteration_count, 3);
    }

    #[test]
    fn reset_loop_clears_state() {
        let conn = test_db();
        let mut state = make_state("p1");
        state.loop_status = "running".to_string();
        state.current_story_id = Some("s1".to_string());
        state.iteration_count = 5;
        upsert_arbiter_state(&conn, &state).unwrap();

        reset_loop(&conn, "p1").unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.loop_status, "idle");
        assert_eq!(state.current_story_id, None);
        assert_eq!(state.iteration_count, 0);
        // max_iterations should be preserved
        assert_eq!(state.max_iterations, 10);
    }

    #[test]
    fn set_trust_level_works() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        set_trust_level(&conn, "p1", TrustLevel::FullAuto).unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.trust_level, TrustLevel::FullAuto);
    }

    #[test]
    fn upsert_replaces_existing() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        let mut updated = make_state("p1");
        updated.max_iterations = 20;
        updated.loop_status = "running".to_string();
        upsert_arbiter_state(&conn, &updated).unwrap();

        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert_eq!(state.max_iterations, 20);
        assert_eq!(state.loop_status, "running");
    }

    #[test]
    fn update_last_activity_sets_timestamp() {
        let conn = test_db();
        upsert_arbiter_state(&conn, &make_state("p1")).unwrap();
        update_last_activity(&conn, "p1").unwrap();
        let state = get_arbiter_state(&conn, "p1").unwrap().unwrap();
        assert!(state.last_activity_at.is_some());
    }
}
