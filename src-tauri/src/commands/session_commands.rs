use crate::db::sessions::PersistedSession;
use crate::notifications::notifier::show_desktop_notification;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn save_sessions(
    state: State<'_, AppState>,
    sessions: Vec<PersistedSession>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::sessions::save_sessions(&conn, &sessions)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<PersistedSession>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::sessions::load_sessions(&conn)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_desktop_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    show_desktop_notification(&app_handle, &title, &body);
    Ok(())
}
