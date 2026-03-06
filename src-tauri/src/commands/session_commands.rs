use crate::sessions::store::{self, PersistedSession};
use crate::notifications::notifier::show_desktop_notification;

#[tauri::command]
pub async fn save_sessions(sessions: Vec<PersistedSession>) -> Result<(), String> {
    store::save_sessions(&sessions)
}

#[tauri::command]
pub async fn load_sessions() -> Result<Vec<PersistedSession>, String> {
    Ok(store::load_sessions())
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
