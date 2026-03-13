use rusqlite::{params, Connection};

use crate::state::Project;

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
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn load_projects_sync(conn: &Connection) -> Vec<Project> {
    list_projects(conn).unwrap_or_default()
}
