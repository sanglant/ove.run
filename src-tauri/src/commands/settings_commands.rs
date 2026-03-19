use crate::error::{lock_err, AppError};
use crate::state::{AppSettings, AppState};
use tauri::State;

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

#[allow(unreachable_code)]
#[tauri::command]
pub async fn reset_database(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let db_path = crate::db::init::db_path(&app_data_dir);
    if db_path.exists() {
        std::fs::remove_file(&db_path)?;
    }
    app.restart();
    Ok(())
}
