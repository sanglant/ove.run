use crate::sessions::store::{self, PersistedSession};

#[tauri::command]
pub async fn save_sessions(sessions: Vec<PersistedSession>) -> Result<(), String> {
    store::save_sessions(&sessions)
}

#[tauri::command]
pub async fn load_sessions() -> Result<Vec<PersistedSession>, String> {
    Ok(store::load_sessions())
}
