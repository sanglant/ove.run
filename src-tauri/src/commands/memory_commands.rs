use chrono::Utc;
use tauri::State;
use uuid::Uuid;

use crate::db::memory;
use crate::error::{AppError, lock_err};
use crate::memory_worker::MemoryWorkerEvent;
use crate::state::{AppState, Consolidation, Memory};

use super::project_commands::run_arbiter_cli;

const EXTRACTION_PROMPT_TEMPLATE: &str = r#"Analyze the following terminal output from an AI coding agent and extract important facts, decisions, and patterns.

Terminal output:
{terminal_output}

For each fact, respond with one line in this format:
MEMORY: {content} | IMPORTANCE: {0.0-1.0} | ENTITIES: {comma-separated} | TOPICS: {comma-separated} | VISIBILITY: {private|public}

Rules:
- Extract decisions, facts, errors, patterns
- VISIBILITY "public" for project-wide decisions, "private" for session-specific
- IMPORTANCE: 1.0 = critical, 0.5 = useful, 0.1 = minor
- Only extract genuinely useful information"#;

#[tauri::command]
pub async fn list_memories(
    state: State<'_, AppState>,
    project_id: String,
    session_id: Option<String>,
) -> Result<Vec<Memory>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    memory::list_memories(&conn, &project_id, session_id.as_deref(), None).map_err(Into::into)
}

#[tauri::command]
pub async fn search_memories(
    state: State<'_, AppState>,
    query: String,
    project_id: String,
    session_id: Option<String>,
    limit: usize,
) -> Result<Vec<Memory>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    memory::search_memories(&conn, &query, &project_id, session_id.as_deref(), limit)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn toggle_memory_visibility(
    state: State<'_, AppState>,
    id: String,
    visibility: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    memory::update_memory_visibility(&conn, &id, &visibility).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_memory(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    memory::delete_memory(&conn, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn list_consolidations(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Consolidation>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    memory::list_consolidations(&conn, &project_id).map_err(Into::into)
}

/// Extract memories from terminal output by calling the arbiter CLI.
/// Parses lines of the form:
///   MEMORY: <content> | IMPORTANCE: <f64> | ENTITIES: <csv> | TOPICS: <csv> | VISIBILITY: <str>
#[tauri::command]
pub async fn extract_memories(
    state: State<'_, AppState>,
    project_id: String,
    session_id: String,
    terminal_output: String,
    project_path: String,
) -> Result<Vec<Memory>, AppError> {
    // Read arbiter settings from AppState
    let (cli_command, model) = {
        let settings = state.settings.read().await;
        let provider = settings.global.arbiter_provider.clone();
        let model = settings.global.arbiter_model.clone();
        // Derive CLI command from provider (matches arbiter_agent_type keys)
        let command = if provider.is_empty() {
            "claude".to_string()
        } else {
            // provider maps to agent command via registry — use provider as command key
            match provider.as_str() {
                "claude" => "claude".to_string(),
                "gemini" => "gemini".to_string(),
                "copilot" => "copilot".to_string(),
                "codex" => "codex".to_string(),
                other => other.to_string(),
            }
        };
        (command, if model.is_empty() { None } else { Some(model) })
    };

    let prompt = EXTRACTION_PROMPT_TEMPLATE.replace("{terminal_output}", &terminal_output);

    let response = run_arbiter_cli(&prompt, &project_path, &cli_command, model.as_deref()).await?;

    // Parse the response
    let now = Utc::now().to_rfc3339();
    let mut memories = Vec::new();

    for line in response.lines() {
        let line = line.trim();
        if !line.starts_with("MEMORY:") {
            continue;
        }

        // Split on pipe delimiters
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 {
            continue;
        }

        let content = parts[0]
            .trim_start_matches("MEMORY:")
            .trim()
            .to_string();

        let importance: f64 = parts[1]
            .trim_start_matches("IMPORTANCE:")
            .trim()
            .parse()
            .unwrap_or(0.5);

        let entities_raw = parts[2]
            .trim_start_matches("ENTITIES:")
            .trim();
        let entities: Vec<String> = entities_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let entities_json = serde_json::to_string(&entities).unwrap_or_else(|_| "[]".to_string());

        let topics_raw = parts[3]
            .trim_start_matches("TOPICS:")
            .trim();
        let topics: Vec<String> = topics_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let topics_json = serde_json::to_string(&topics).unwrap_or_else(|_| "[]".to_string());

        let visibility = parts[4]
            .trim_start_matches("VISIBILITY:")
            .trim()
            .to_string();
        let visibility = if visibility == "public" || visibility == "private" {
            visibility
        } else {
            "private".to_string()
        };

        if content.is_empty() {
            continue;
        }

        let mem = Memory {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.clone(),
            session_id: Some(session_id.clone()),
            visibility,
            content,
            summary: None,
            entities_json,
            topics_json,
            importance: importance.clamp(0.0, 1.0),
            consolidated: false,
            created_at: now.clone(),
        };

        {
            let conn = state.db.lock().map_err(lock_err)?;
            memory::create_memory(&conn, &mem)?;
        }

        memories.push(mem);
    }

    Ok(memories)
}

/// Trigger background consolidation check for a project.
#[tauri::command]
pub async fn check_consolidation(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
) -> Result<(), AppError> {
    state
        .memory_worker_tx
        .send(MemoryWorkerEvent::ConsolidateProject {
            project_id,
            project_path,
        })
        .await
        .map_err(|e| AppError::Channel(format!("Failed to send consolidation event: {}", e)))
}
