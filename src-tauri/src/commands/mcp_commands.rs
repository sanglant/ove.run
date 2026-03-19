use crate::error::AppError;
use crate::mcp::activity::McpActivity;
use crate::mcp::questions::{PendingQuestionInfo, QuestionResponse};
use crate::state::AppState;
use tauri::State;

/// Injects the ove-run MCP server entry into the agent's config file.
/// Safe to call multiple times — only the "ove-run" key is modified.
#[tauri::command]
pub async fn prepare_mcp_config(
    state: State<'_, AppState>,
    project_path: String,
    agent_type: Option<String>,
) -> Result<(), AppError> {
    let port = state.mcp_port;
    if port == 0 {
        // MCP server failed to start at app launch — skip silently
        return Ok(());
    }
    let agent = agent_type.as_deref().unwrap_or("claude");
    crate::mcp::config::inject_mcp_config(&project_path, port, agent)
        .map_err(AppError::Other)
}

/// Removes the ove-run MCP server entry from the agent's config file.
/// All other keys are preserved.
#[tauri::command]
pub async fn cleanup_mcp_config(
    _state: State<'_, AppState>,
    project_path: String,
    agent_type: Option<String>,
) -> Result<(), AppError> {
    let agent = agent_type.as_deref().unwrap_or("claude");
    crate::mcp::config::remove_mcp_config(&project_path, agent)
        .map_err(AppError::Other)
}

/// Answers a pending MCP question (called by frontend when user responds)
#[tauri::command]
pub async fn answer_mcp_question(
    state: State<'_, AppState>,
    question_id: String,
    response: String,
    option_index: Option<usize>,
) -> Result<(), AppError> {
    state
        .question_manager
        .answer_question(
            &question_id,
            QuestionResponse {
                response,
                option_index,
                auto_resolved: false,
            },
        )
        .await
        .map_err(AppError::Other)
}

/// Returns the activity log for MCP Manager panel
#[tauri::command]
pub async fn list_mcp_activities(
    state: State<'_, AppState>,
    session_id: Option<String>,
) -> Result<Vec<McpActivity>, AppError> {
    Ok(state.activity_store.list(session_id.as_deref()).await)
}

/// Returns pending questions for MCP Manager panel
#[tauri::command]
pub async fn list_pending_questions(
    state: State<'_, AppState>,
) -> Result<Vec<PendingQuestionInfo>, AppError> {
    Ok(state.question_manager.list_pending().await)
}

/// Returns MCP server status
#[tauri::command]
pub async fn get_mcp_server_status(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({
        "running": state.mcp_port > 0,
        "port": state.mcp_port,
    }))
}
