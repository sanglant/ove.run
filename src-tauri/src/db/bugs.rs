use rusqlite::{params, Connection};

pub fn load_bug_config(
    conn: &Connection,
    project_id: &str,
) -> Result<Option<(String, String)>, rusqlite::Error> {
    let mut stmt =
        conn.prepare("SELECT provider, config_json FROM bug_configs WHERE project_id = ?1")?;
    let mut rows = stmt.query(params![project_id])?;
    match rows.next()? {
        Some(row) => {
            let provider: String = row.get(0)?;
            let config_json: String = row.get(1)?;
            Ok(Some((provider, config_json)))
        }
        None => Ok(None),
    }
}

pub fn save_bug_config(
    conn: &Connection,
    project_id: &str,
    provider: &str,
    config_json: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO bug_configs (project_id, provider, config_json, auth_json) VALUES (?1, ?2, ?3, COALESCE((SELECT auth_json FROM bug_configs WHERE project_id = ?1), '{}'))",
        params![project_id, provider, config_json],
    )?;
    Ok(())
}

pub fn save_bug_auth(
    conn: &Connection,
    project_id: &str,
    auth_json: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE bug_configs SET auth_json = ?1 WHERE project_id = ?2",
        params![auth_json, project_id],
    )?;
    Ok(())
}

pub fn load_bug_auth(
    conn: &Connection,
    project_id: &str,
) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT auth_json FROM bug_configs WHERE project_id = ?1")?;
    let mut rows = stmt.query(params![project_id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

pub fn delete_bug_data(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM bug_configs WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}
