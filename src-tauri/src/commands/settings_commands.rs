use tauri::State;
use crate::error::{AppError, lock_err};
use crate::state::{AppSettings, AppState};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let settings = state.settings.read().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), AppError> {
    {
        let conn = state.db.lock().map_err(lock_err)?;
        crate::db::settings::save_app_settings(&conn, &settings)?;
    }
    let mut current = state.settings.write().await;
    *current = settings;
    Ok(())
}
