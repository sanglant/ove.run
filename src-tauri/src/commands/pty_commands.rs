use std::collections::HashMap;
use tauri::{AppHandle, State};
use crate::state::AppState;

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
) -> Result<(), String> {
    let mut manager = state.pty_manager.write().await;
    manager.spawn(session_id, command, args, cwd, env, cols, rows, app)
}

#[tauri::command]
pub async fn write_pty(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut manager = state.pty_manager.write().await;
    manager.write(&session_id, data)
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut manager = state.pty_manager.write().await;
    manager.resize(&session_id, cols, rows)
}

#[tauri::command]
pub async fn kill_pty(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut manager = state.pty_manager.write().await;
    manager.kill(&session_id)
}
