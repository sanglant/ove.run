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

fn list_stories_by_status(conn: &Connection, project_id: &str, status: &str) -> Result<Vec<Story>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, description, acceptance_criteria, priority, status, \
         depends_on_json, iteration_attempts, created_at \
         FROM stories WHERE project_id = ?1 AND status = ?2 ORDER BY priority DESC, created_at ASC"
    )?;

    let rows = stmt.query_map(params![project_id, status], row_to_story)?;
    rows.collect()
}
