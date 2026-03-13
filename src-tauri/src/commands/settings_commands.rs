use tauri::State;
use crate::state::{AppSettings, AppState};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.read().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        crate::db::settings::save_app_settings(&conn, &settings)
            .map_err(|e| e.to_string())?;
    }
    let mut current = state.settings.write().await;
    *current = settings;
    Ok(())
}
