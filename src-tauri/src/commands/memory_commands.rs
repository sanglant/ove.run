use chrono::Utc;
use tauri::State;
use uuid::Uuid;

use crate::db::memory;
use crate::error::{lock_err, AppError};
use crate::memory_worker::MemoryWorkerEvent;
use crate::state::{AppState, Consolidation, Memory};

use super::project_commands::run_arbiter_cli;

const EXTRACTION_PROMPT_TEMPLATE: &str = r#"Analyze the following terminal output from an AI coding agent. Extract ONLY information that would be valuable in future sessions — things a developer would want to remember days or weeks later.

Terminal output:
{terminal_output}

For each fact, respond with one line in this format:
MEMORY: {content} | IMPORTANCE: {0.0-1.0} | ENTITIES: {comma-separated} | TOPICS: {comma-separated} | VISIBILITY: {private|public}

EXTRACT:
- Architectural decisions and their rationale
- Non-obvious configuration or environment requirements
- Discovered bugs, gotchas, or workarounds
- Agreed-upon conventions or patterns
- Dependency choices and why alternatives were rejected

DO NOT EXTRACT:
- Routine operations (file reads, installs, test runs, builds)
- Progress updates or status messages
- Obvious facts derivable from the code itself
- Temporary debugging steps
- Generic error messages without resolution context

Rules:
- VISIBILITY "public" for project-wide decisions, "private" for session-specific
- IMPORTANCE: 1.0 = critical decision, 0.7 = useful context, 0.4 = minor detail
- Prefer fewer high-quality memories over many low-quality ones
- If nothing worth remembering happened, respond with: NO_MEMORIES"#;

/// Minimum importance score to persist a memory. Anything below is noise.
const MIN_IMPORTANCE_THRESHOLD: f64 = 0.3;

const GENERATE_MEMORY_PROMPT_TEMPLATE: &str = r#"The user wants to add memories to an AI coding agent project. Generate one or more structured memories based on their description.

User's description:
{user_prompt}

For each memory to create, respond with one line in this format:
MEMORY: {content} | IMPORTANCE: {0.0-1.0} | ENTITIES: {comma-separated} | TOPICS: {comma-separated} | VISIBILITY: {private|public}

Rules:
- IMPORTANCE: 1.0 = critical decision, 0.7 = useful context, 0.4 = minor detail
- VISIBILITY "public" for project-wide knowledge, "private" for specific details
- Keep content concise but complete — a future agent should understand it without additional context
- If the description contains multiple distinct facts, create separate memories for each
- Only respond with MEMORY lines, no other text"#;

const CLEAN_MEMORIES_PROMPT_TEMPLATE: &str = r#"Review the following agent memories for a software project. Identify memories that should be removed because they are:
- Duplicates or near-duplicates of other memories
- Low quality, vague, or unhelpful
- Temporary debugging notes no longer relevant
- Noise or routine operations not worth keeping

{user_instruction}

Memories (format: [id] importance=X.X — content):
{memories_list}

For each memory to remove, respond with one line:
DELETE: {id}

If no memories should be removed, respond with: NONE
Only respond with DELETE lines or NONE, no other text."#;

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
pub async fn delete_memory(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
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
    let (cli_command, model, timeout_seconds) = {
        let settings = state.settings.read().await;
        let provider = settings.global.arbiter_provider.clone();
        let model = settings.global.arbiter_model.clone();
        let timeout = settings.global.arbiter_timeout_seconds as u64;
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
        (
            command,
            if model.is_empty() { None } else { Some(model) },
            timeout,
        )
    };

    let prompt = EXTRACTION_PROMPT_TEMPLATE.replace("{terminal_output}", &terminal_output);

    let response = run_arbiter_cli(
        &prompt,
        &project_path,
        &cli_command,
        model.as_deref(),
        timeout_seconds,
    )
    .await?;

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

        let content = parts[0].trim_start_matches("MEMORY:").trim().to_string();

        let importance: f64 = parts[1]
            .trim_start_matches("IMPORTANCE:")
            .trim()
            .parse()
            .unwrap_or(0.5);

        let entities_raw = parts[2].trim_start_matches("ENTITIES:").trim();
        let entities: Vec<String> = entities_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let entities_json = serde_json::to_string(&entities).unwrap_or_else(|_| "[]".to_string());

        let topics_raw = parts[3].trim_start_matches("TOPICS:").trim();
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

        let importance = importance.clamp(0.0, 1.0);
        if importance < MIN_IMPORTANCE_THRESHOLD {
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
            importance,
            consolidated: false,
            created_at: now.clone(),
        };

        memories.push(mem);
    }

    // Acquire the DB lock once and insert all parsed memories in a single
    // transaction instead of locking per item inside the parse loop.
    if !memories.is_empty() {
        let conn = state.db.lock().map_err(lock_err)?;
        // SAFETY: unchecked_transaction does not require &mut Connection.
        // The transaction is rolled back automatically on drop if commit() is not called.
        let tx = conn.unchecked_transaction().map_err(AppError::Db)?;
        for mem in &memories {
            memory::create_memory(&tx, mem)?;
        }
        tx.commit().map_err(AppError::Db)?;
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

#[tauri::command]
pub async fn delete_all_memories(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    conn.execute(
        "DELETE FROM consolidations WHERE project_id = ?1",
        rusqlite::params![&project_id],
    )
    .map_err(AppError::Db)?;
    conn.execute(
        "DELETE FROM memories WHERE project_id = ?1",
        rusqlite::params![&project_id],
    )
    .map_err(AppError::Db)?;
    // Rebuild FTS indexes after bulk delete
    conn.execute_batch(
        "INSERT INTO memories_fts(memories_fts) VALUES('rebuild');\
         INSERT INTO consolidations_fts(consolidations_fts) VALUES('rebuild');",
    )
    .map_err(AppError::Db)?;
    Ok(())
}

#[tauri::command]
pub async fn arbiter_generate_memory(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    prompt: String,
) -> Result<Vec<Memory>, AppError> {
    let (cli_command, model, timeout_seconds) = {
        let settings = state.settings.read().await;
        let provider = settings.global.arbiter_provider.clone();
        let model = settings.global.arbiter_model.clone();
        let timeout = settings.global.arbiter_timeout_seconds as u64;
        let command = match provider.as_str() {
            "claude" | "" => "claude".to_string(),
            "gemini" => "gemini".to_string(),
            "copilot" => "copilot".to_string(),
            "codex" => "codex".to_string(),
            other => other.to_string(),
        };
        (
            command,
            if model.is_empty() { None } else { Some(model) },
            timeout,
        )
    };

    let full_prompt = GENERATE_MEMORY_PROMPT_TEMPLATE.replace("{user_prompt}", &prompt);

    let response = run_arbiter_cli(
        &full_prompt,
        &project_path,
        &cli_command,
        model.as_deref(),
        timeout_seconds,
    )
    .await?;

    let now = Utc::now().to_rfc3339();
    let mut memories = Vec::new();

    for line in response.lines() {
        let line = line.trim();
        if !line.starts_with("MEMORY:") {
            continue;
        }

        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 {
            continue;
        }

        let content = parts[0].trim_start_matches("MEMORY:").trim().to_string();
        let importance: f64 = parts[1]
            .trim_start_matches("IMPORTANCE:")
            .trim()
            .parse()
            .unwrap_or(0.5);
        let entities_raw = parts[2].trim_start_matches("ENTITIES:").trim();
        let entities: Vec<String> = entities_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let entities_json = serde_json::to_string(&entities).unwrap_or_else(|_| "[]".to_string());
        let topics_raw = parts[3].trim_start_matches("TOPICS:").trim();
        let topics: Vec<String> = topics_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let topics_json = serde_json::to_string(&topics).unwrap_or_else(|_| "[]".to_string());
        let visibility = {
            let v = parts[4].trim_start_matches("VISIBILITY:").trim().to_string();
            if v == "public" { v } else { "private".to_string() }
        };

        if content.is_empty() {
            continue;
        }
        let importance = importance.clamp(0.0, 1.0);
        if importance < MIN_IMPORTANCE_THRESHOLD {
            continue;
        }

        memories.push(Memory {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.clone(),
            session_id: None,
            visibility,
            content,
            summary: None,
            entities_json,
            topics_json,
            importance,
            consolidated: false,
            created_at: now.clone(),
        });
    }

    if !memories.is_empty() {
        let conn = state.db.lock().map_err(lock_err)?;
        let tx = conn.unchecked_transaction().map_err(AppError::Db)?;
        for mem in &memories {
            memory::create_memory(&tx, mem)?;
        }
        tx.commit().map_err(AppError::Db)?;
    }

    Ok(memories)
}

#[tauri::command]
pub async fn arbiter_clean_memories(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    instruction: String,
) -> Result<Vec<String>, AppError> {
    let (cli_command, model, timeout_seconds) = {
        let settings = state.settings.read().await;
        let provider = settings.global.arbiter_provider.clone();
        let model = settings.global.arbiter_model.clone();
        let timeout = settings.global.arbiter_timeout_seconds as u64;
        let command = match provider.as_str() {
            "claude" | "" => "claude".to_string(),
            other => other.to_string(),
        };
        (
            command,
            if model.is_empty() { None } else { Some(model) },
            timeout,
        )
    };

    // Load existing memories (up to 100, ordered by importance desc)
    let existing_memories = {
        let conn = state.db.lock().map_err(lock_err)?;
        let mut mems = memory::list_memories(&conn, &project_id, None, None)
            .unwrap_or_default();
        mems.sort_by(|a, b| b.importance.partial_cmp(&a.importance).unwrap_or(std::cmp::Ordering::Equal));
        mems.truncate(100);
        mems
    };

    if existing_memories.is_empty() {
        return Ok(vec![]);
    }

    let memories_list = existing_memories
        .iter()
        .map(|m| format!("[{}] importance={:.1} — {}", m.id, m.importance, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let user_instruction = if instruction.trim().is_empty() {
        "Apply general quality standards.".to_string()
    } else {
        format!("Additional instruction: {}", instruction.trim())
    };

    let full_prompt = CLEAN_MEMORIES_PROMPT_TEMPLATE
        .replace("{user_instruction}", &user_instruction)
        .replace("{memories_list}", &memories_list);

    let response = run_arbiter_cli(
        &full_prompt,
        &project_path,
        &cli_command,
        model.as_deref(),
        timeout_seconds,
    )
    .await?;

    let ids_to_delete: Vec<String> = response
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.starts_with("DELETE:") {
                let id = line.trim_start_matches("DELETE:").trim().to_string();
                if !id.is_empty() && id != "NONE" && existing_memories.iter().any(|m| m.id == id) {
                    Some(id)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    Ok(ids_to_delete)
}
