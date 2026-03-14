use crate::db::sessions::PersistedSession;
use crate::error::{AppError, lock_err};
use crate::notifications::notifier::show_desktop_notification;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn save_sessions(
    state: State<'_, AppState>,
    sessions: Vec<PersistedSession>,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::sessions::save_sessions(&conn, &sessions)?;
    Ok(())
}

#[tauri::command]
pub async fn load_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<PersistedSession>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::sessions::load_sessions(&conn).map_err(Into::into)
}

#[tauri::command]
pub async fn send_desktop_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), AppError> {
    show_desktop_notification(&app_handle, &title, &body);
    Ok(())
}
