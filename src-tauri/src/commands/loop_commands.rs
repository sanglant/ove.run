use tauri::State;
use crate::error::{AppError, lock_err};
use crate::state::{AppState, QualityGateConfig};
use crate::loop_engine::engine::LoopCommand;

#[tauri::command]
pub async fn start_loop(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    user_request: Option<String>,
) -> Result<(), AppError> {
    state.loop_cmd_tx.send(LoopCommand::Start { project_id, project_path, user_request })
        .await
        .map_err(|e| AppError::Channel(format!("Failed to send start: {}", e)))
}

#[tauri::command]
pub async fn pause_loop(state: State<'_, AppState>) -> Result<(), AppError> {
    state.loop_cmd_tx.send(LoopCommand::Pause)
        .await
        .map_err(|e| AppError::Channel(format!("Failed to send pause: {}", e)))
}

#[tauri::command]
pub async fn resume_loop(state: State<'_, AppState>) -> Result<(), AppError> {
    state.loop_cmd_tx.send(LoopCommand::Resume)
        .await
        .map_err(|e| AppError::Channel(format!("Failed to send resume: {}", e)))
}

#[tauri::command]
pub async fn cancel_loop(state: State<'_, AppState>) -> Result<(), AppError> {
    state.loop_cmd_tx.send(LoopCommand::Cancel)
        .await
        .map_err(|e| AppError::Channel(format!("Failed to send cancel: {}", e)))
}

#[tauri::command]
pub async fn get_loop_state(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<serde_json::Value, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    let arb_state = crate::db::arbiter_state::get_arbiter_state(&conn, &project_id)?;
    let stories = crate::db::stories::list_stories(&conn, &project_id)?;
    Ok(serde_json::json!({
        "arbiter_state": arb_state,
        "stories": stories,
    }))
}

#[tauri::command]
pub async fn set_quality_gates(
    state: State<'_, AppState>,
    project_id: String,
    config: QualityGateConfig,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    let key = format!("quality_gates_{}", project_id);
    let json = serde_json::to_string(&config)
        .map_err(|e| AppError::Other(e.to_string()))?;
    crate::db::settings::set_setting(&conn, &key, &json).map_err(Into::into)
}

#[tauri::command]
pub async fn get_quality_gates(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<QualityGateConfig, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    let key = format!("quality_gates_{}", project_id);
    match crate::db::settings::get_setting(&conn, &key)? {
        Some(json) => serde_json::from_str(&json).map_err(|e| AppError::Other(e.to_string())),
        None => Ok(QualityGateConfig::default()),
    }
}

#[tauri::command]
pub async fn set_max_iterations(
    state: State<'_, AppState>,
    project_id: String,
    max: i32,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    if let Some(mut arb) = crate::db::arbiter_state::get_arbiter_state(&conn, &project_id)? {
        arb.max_iterations = max;
        crate::db::arbiter_state::upsert_arbiter_state(&conn, &arb).map_err(Into::into)
    } else {
        Err(AppError::NotFound("Arbiter state not found".to_string()))
    }
}
