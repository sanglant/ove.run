use rusqlite::{Connection, params};
use crate::state::Story;

fn row_to_story(row: &rusqlite::Row) -> Result<Story, rusqlite::Error> {
    Ok(Story {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        acceptance_criteria: row.get(4)?,
        priority: row.get(5)?,
        status: row.get(6)?,
        depends_on_json: row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".to_string()),
        iteration_attempts: row.get(8)?,
        created_at: row.get(9)?,
    })
}

pub fn create_story(conn: &Connection, story: &Story) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO stories \
         (id, project_id, title, description, acceptance_criteria, priority, status, depends_on_json, iteration_attempts, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            story.id,
            story.project_id,
            story.title,
            story.description,
            story.acceptance_criteria,
            story.priority,
            story.status,
            story.depends_on_json,
            story.iteration_attempts,
            story.created_at,
        ],
    )?;
    Ok(())
}

pub fn create_stories_batch(conn: &Connection, stories: &[Story]) -> Result<(), rusqlite::Error> {
    for story in stories {
        create_story(conn, story)?;
    }
    Ok(())
}

pub fn list_stories(conn: &Connection, project_id: &str) -> Result<Vec<Story>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, description, acceptance_criteria, priority, status, \
         depends_on_json, iteration_attempts, created_at \
         FROM stories WHERE project_id = ?1 ORDER BY priority DESC, created_at ASC"
    )?;

    let rows = stmt.query_map(params![project_id], row_to_story)?;
    rows.collect()
}

pub fn get_story(conn: &Connection, id: &str) -> Result<Story, rusqlite::Error> {
    conn.query_row(
        "SELECT id, project_id, title, description, acceptance_criteria, priority, status, \
         depends_on_json, iteration_attempts, created_at \
         FROM stories WHERE id = ?1",
        params![id],
        row_to_story,
    )
}

pub fn update_story_status(conn: &Connection, id: &str, status: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE stories SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn increment_story_attempts(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE stories SET iteration_attempts = iteration_attempts + 1 WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn update_story(conn: &Connection, story: &Story) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE stories SET \
         title = ?1, description = ?2, acceptance_criteria = ?3, priority = ?4, \
         status = ?5, depends_on_json = ?6, iteration_attempts = ?7 \
         WHERE id = ?8",
        params![
            story.title,
            story.description,
            story.acceptance_criteria,
            story.priority,
            story.status,
            story.depends_on_json,
            story.iteration_attempts,
            story.id,
        ],
    )?;
    Ok(())
}

pub fn delete_story(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM stories WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_project_stories(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM stories WHERE project_id = ?1", params![project_id])?;
    Ok(())
}

pub fn get_next_story(conn: &Connection, project_id: &str) -> Result<Option<Story>, rusqlite::Error> {
    let pending = list_stories_by_status(conn, project_id, "pending")?;

    for story in pending {
        let deps: Vec<String> = serde_json::from_str(&story.depends_on_json)
            .unwrap_or_default();

        let all_deps_done = deps.iter().all(|dep_id| {
            conn.query_row(
                "SELECT status FROM stories WHERE id = ?1",
                params![dep_id],
                |row| row.get::<_, String>(0),
            )
            .map(|status| status == "completed")
            .unwrap_or(false)
        });

        if all_deps_done {
            return Ok(Some(story));
        }
    }

    Ok(None)
}

pub fn all_stories_complete(conn: &Connection, project_id: &str) -> Result<bool, rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM stories WHERE project_id = ?1 AND status != 'completed' AND status != 'skipped'",
        params![project_id],
        |row| row.get(0),
    )?;
    Ok(count == 0)
}

pub fn count_incomplete_stories(conn: &Connection, project_id: &str) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM stories WHERE project_id = ?1 AND status != 'completed' AND status != 'skipped'",
        params![project_id],
        |row| row.get(0),
    )
}

fn list_stories_by_status(conn: &Connection, project_id: &str, status: &str) -> Result<Vec<Story>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, description, acceptance_criteria, priority, status, \
         depends_on_json, iteration_attempts, created_at \
         FROM stories WHERE project_id = ?1 AND status = ?2 ORDER BY priority DESC, created_at ASC"
    )?;

    let rows = stmt.query_map(params![project_id, status], row_to_story)?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=OFF;").unwrap(); // skip FK for isolated tests
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                acceptance_criteria TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                depends_on_json TEXT DEFAULT '[]',
                iteration_attempts INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );"
        ).unwrap();
        conn
    }

    fn make_story(id: &str, project_id: &str, status: &str, deps: &[&str]) -> Story {
        Story {
            id: id.to_string(),
            project_id: project_id.to_string(),
            title: format!("Story {}", id),
            description: "desc".to_string(),
            acceptance_criteria: None,
            priority: 0,
            status: status.to_string(),
            depends_on_json: serde_json::to_string(
                &deps.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            ).unwrap(),
            iteration_attempts: 0,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn create_and_get_story() {
        let conn = test_db();
        let story = make_story("s1", "p1", "pending", &[]);
        create_story(&conn, &story).unwrap();
        let fetched = get_story(&conn, "s1").unwrap();
        assert_eq!(fetched.id, "s1");
        assert_eq!(fetched.title, "Story s1");
        assert_eq!(fetched.status, "pending");
    }

    #[test]
    fn list_stories_by_project() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &[])).unwrap();
        create_story(&conn, &make_story("s3", "p2", "pending", &[])).unwrap();
        let stories = list_stories(&conn, "p1").unwrap();
        assert_eq!(stories.len(), 2);
    }

    #[test]
    fn update_story_status_works() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        update_story_status(&conn, "s1", "completed").unwrap();
        let story = get_story(&conn, "s1").unwrap();
        assert_eq!(story.status, "completed");
    }

    #[test]
    fn increment_story_attempts_works() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        increment_story_attempts(&conn, "s1").unwrap();
        increment_story_attempts(&conn, "s1").unwrap();
        let story = get_story(&conn, "s1").unwrap();
        assert_eq!(story.iteration_attempts, 2);
    }

    #[test]
    fn get_next_story_returns_first_pending() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &[])).unwrap();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_some());
        assert_eq!(next.unwrap().id, "s1");
    }

    #[test]
    fn get_next_story_skips_completed() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "completed", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &[])).unwrap();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_some());
        assert_eq!(next.unwrap().id, "s2");
    }

    #[test]
    fn get_next_story_respects_dependencies() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &["s2"])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &[])).unwrap();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_some());
        // s1 depends on s2, s2 has no deps → s2 should be next
        assert_eq!(next.unwrap().id, "s2");
    }

    #[test]
    fn get_next_story_allows_completed_deps() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &["s2"])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "completed", &[])).unwrap();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_some());
        // s2 is completed, so s1's dependency is satisfied
        assert_eq!(next.unwrap().id, "s1");
    }

    #[test]
    fn get_next_story_returns_none_when_all_blocked() {
        let conn = test_db();
        // Circular dependency: s1 depends on s2, s2 depends on s1
        create_story(&conn, &make_story("s1", "p1", "pending", &["s2"])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &["s1"])).unwrap();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_none());
    }

    #[test]
    fn get_next_story_returns_none_when_empty() {
        let conn = test_db();
        let next = get_next_story(&conn, "p1").unwrap();
        assert!(next.is_none());
    }

    #[test]
    fn all_stories_complete_true_when_all_completed() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "completed", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "completed", &[])).unwrap();
        assert!(all_stories_complete(&conn, "p1").unwrap());
    }

    #[test]
    fn all_stories_complete_true_with_skipped() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "completed", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "skipped", &[])).unwrap();
        assert!(all_stories_complete(&conn, "p1").unwrap());
    }

    #[test]
    fn all_stories_complete_false_when_pending() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "completed", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "pending", &[])).unwrap();
        assert!(!all_stories_complete(&conn, "p1").unwrap());
    }

    #[test]
    fn all_stories_complete_true_when_empty() {
        let conn = test_db();
        // No stories at all = vacuously complete
        assert!(all_stories_complete(&conn, "p1").unwrap());
    }

    #[test]
    fn all_stories_complete_false_when_failed() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "failed", &[])).unwrap();
        assert!(!all_stories_complete(&conn, "p1").unwrap());
    }

    #[test]
    fn delete_story_works() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        delete_story(&conn, "s1").unwrap();
        assert!(get_story(&conn, "s1").is_err());
    }

    #[test]
    fn delete_project_stories_removes_all() {
        let conn = test_db();
        create_story(&conn, &make_story("s1", "p1", "pending", &[])).unwrap();
        create_story(&conn, &make_story("s2", "p1", "completed", &[])).unwrap();
        create_story(&conn, &make_story("s3", "p2", "pending", &[])).unwrap();
        delete_project_stories(&conn, "p1").unwrap();
        assert_eq!(list_stories(&conn, "p1").unwrap().len(), 0);
        assert_eq!(list_stories(&conn, "p2").unwrap().len(), 1);
    }

    #[test]
    fn create_stories_batch_works() {
        let conn = test_db();
        let stories = vec![
            make_story("s1", "p1", "pending", &[]),
            make_story("s2", "p1", "pending", &[]),
        ];
        create_stories_batch(&conn, &stories).unwrap();
        assert_eq!(list_stories(&conn, "p1").unwrap().len(), 2);
    }

    #[test]
    fn get_next_story_respects_priority_ordering() {
        let conn = test_db();
        let mut low = make_story("s1", "p1", "pending", &[]);
        low.priority = 1;
        low.created_at = "2026-01-01T00:00:00Z".to_string();
        let mut high = make_story("s2", "p1", "pending", &[]);
        high.priority = 10;
        high.created_at = "2026-01-02T00:00:00Z".to_string();
        create_story(&conn, &low).unwrap();
        create_story(&conn, &high).unwrap();
        let next = get_next_story(&conn, "p1").unwrap().unwrap();
        // Higher priority should come first (ORDER BY priority DESC)
        assert_eq!(next.id, "s2");
    }
}
