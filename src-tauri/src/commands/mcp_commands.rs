use crate::error::AppError;
use crate::state::AppState;
use tauri::State;

/// Injects the ove-run MCP server entry into <project_path>/.claude/settings.local.json.
/// Safe to call multiple times — only the "ove-run" key is modified.
#[tauri::command]
pub async fn prepare_mcp_config(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<(), AppError> {
    let port = state.mcp_port;
    if port == 0 {
        // MCP server failed to start at app launch — skip silently
        return Ok(());
    }
    crate::mcp::config::inject_mcp_config(&project_path, port)
        .map_err(AppError::Other)
}

/// Removes the ove-run MCP server entry from settings.local.json.
/// All other keys are preserved.
#[tauri::command]
pub async fn cleanup_mcp_config(
    _state: State<'_, AppState>,
    project_path: String,
) -> Result<(), AppError> {
    crate::mcp::config::remove_mcp_config(&project_path)
        .map_err(AppError::Other)
}
