use tauri::State;
use crate::settings::store;
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
    store::save_settings(&settings)?;
    let mut current = state.settings.write().await;
    *current = settings;
    Ok(())
}
