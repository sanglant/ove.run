use std::collections::HashMap;
use tauri::{AppHandle, State};
use crate::error::AppError;
use crate::state::AppState;
use crate::sandbox;

#[tauri::command]
pub async fn spawn_pty(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    env: HashMap<String, String>,
    cols: u16,
    rows: u16,
    #[allow(unused_variables)]
    sandbox_enabled: Option<bool>,
    #[allow(unused_variables)]
    trust_level: Option<u32>,
) -> Result<(), AppError> {
    // Apply sandbox wrapping if enabled
    let (final_cmd, final_args, final_env) = if sandbox_enabled.unwrap_or(false) {
        let level = trust_level.unwrap_or(2);
        sandbox::wrap_command(level, &cwd, &command, &args, &env)
    } else {
        (command, args, env)
    };

    let mut manager = state.pty_manager.write().await;
    manager.spawn(session_id, final_cmd, final_args, cwd, final_env, cols, rows, app)
        .map_err(AppError::Pty)
}

#[tauri::command]
pub async fn write_pty(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.write(&session_id, data).map_err(AppError::Pty)
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.resize(&session_id, cols, rows).map_err(AppError::Pty)
}

#[tauri::command]
pub async fn kill_pty(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), AppError> {
    let mut manager = state.pty_manager.write().await;
    manager.kill(&session_id).map_err(AppError::Pty)
}
