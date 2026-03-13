use rusqlite::{params, Connection};

use crate::state::AppSettings;

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT value_json FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value_json: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value_json) VALUES (?1, ?2)",
        params![key, value_json],
    )?;
    Ok(())
}

pub fn load_app_settings(conn: &Connection) -> AppSettings {
    let default = AppSettings::default();

    let global = match get_setting(conn, "global") {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or(default.global.clone()),
        _ => default.global.clone(),
    };

    let agents = match get_setting(conn, "agents") {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or(default.agents.clone()),
        _ => default.agents.clone(),
    };

    AppSettings { global, agents }
}

pub fn save_app_settings(conn: &Connection, settings: &AppSettings) -> Result<(), rusqlite::Error> {
    let global_json = serde_json::to_string(&settings.global).unwrap_or_default();
    let agents_json = serde_json::to_string(&settings.agents).unwrap_or_default();

    set_setting(conn, "global", &global_json)?;
    set_setting(conn, "agents", &agents_json)?;
    Ok(())
}
