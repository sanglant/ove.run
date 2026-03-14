use crate::error::{AppError, lock_err};
use crate::state::{AppState, ContextUnit};
use tauri::State;

#[tauri::command]
pub async fn list_context_units(
    state: State<'_, AppState>,
    project_id: Option<String>,
) -> Result<Vec<ContextUnit>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::list_context_units(&conn, project_id.as_deref()).map_err(Into::into)
}

#[tauri::command]
pub async fn create_context_unit(
    state: State<'_, AppState>,
    unit: ContextUnit,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::create_context_unit(&conn, &unit).map_err(Into::into)
}

#[tauri::command]
pub async fn update_context_unit(
    state: State<'_, AppState>,
    unit: ContextUnit,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::update_context_unit(&conn, &unit).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_context_unit(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::delete_context_unit(&conn, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn search_context_units(
    state: State<'_, AppState>,
    query: String,
    project_id: Option<String>,
) -> Result<Vec<ContextUnit>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::search_context_units(&conn, &query, project_id.as_deref())
        .map_err(Into::into)
}

#[tauri::command]
pub async fn assign_context(
    state: State<'_, AppState>,
    unit_id: String,
    session_id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::assign_context_to_session(&conn, &unit_id, &session_id)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn unassign_context(
    state: State<'_, AppState>,
    unit_id: String,
    session_id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::unassign_context_from_session(&conn, &unit_id, &session_id)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn list_session_context(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<ContextUnit>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::list_session_context(&conn, &session_id).map_err(Into::into)
}

#[tauri::command]
pub async fn set_project_default_context(
    state: State<'_, AppState>,
    unit_id: String,
    project_id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::set_project_default(&conn, &unit_id, &project_id).map_err(Into::into)
}

#[tauri::command]
pub async fn remove_project_default_context(
    state: State<'_, AppState>,
    unit_id: String,
    project_id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::remove_project_default(&conn, &unit_id, &project_id).map_err(Into::into)
}

#[tauri::command]
pub async fn list_project_default_context(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<ContextUnit>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::list_project_defaults(&conn, &project_id).map_err(Into::into)
}

// Task 4: L0/L1 summary generation via Arbiter CLI

#[tauri::command]
pub async fn generate_context_summary(
    state: State<'_, AppState>,
    unit_id: String,
    project_path: String,
) -> Result<(), AppError> {
    // 1. Read the context unit
    let unit = {
        let conn = state.db.lock().map_err(lock_err)?;
        crate::db::context::get_context_unit(&conn, &unit_id)?
    };

    let content = unit.l2_content.as_deref().unwrap_or("");
    if content.is_empty() {
        return Err(AppError::Validation(
            "Context unit has no content to summarize".to_string(),
        ));
    }

    // 2. Build prompt
    let prompt = format!(
        "Given the following content for a context unit named \"{}\" of type \"{}\":\n\n{}\n\n\
         Generate two summaries:\n\
         L0_SUMMARY: A single sentence (max 100 tokens) describing what this content is about.\n\
         L1_OVERVIEW: A structured overview (max 2000 tokens) covering key points, usage, and relevance.",
        unit.name, unit.unit_type, content
    );

    // 3. Call arbiter_review (reuse existing function)
    let response = crate::commands::project_commands::arbiter_review(
        prompt, project_path, None, None
    ).await?;

    // 4. Parse response — line-by-line to handle multi-line L1 content
    let l0 = response.lines()
        .find(|l| l.starts_with("L0_SUMMARY:"))
        .map(|l| l.trim_start_matches("L0_SUMMARY:").trim().to_string());

    let l1 = {
        let mut found = false;
        let mut lines: Vec<&str> = Vec::new();
        for line in response.lines() {
            if line.starts_with("L1_OVERVIEW:") {
                found = true;
                let rest = line.trim_start_matches("L1_OVERVIEW:").trim();
                if !rest.is_empty() {
                    lines.push(rest);
                }
            } else if found {
                lines.push(line);
            }
        }
        if found { Some(lines.join("\n").trim().to_string()) } else { None }
    };

    // 5. Update the unit
    let mut updated = unit;
    if let Some(s) = l0 { updated.l0_summary = Some(s); }
    if let Some(s) = l1 { updated.l1_overview = Some(s); }
    updated.updated_at = chrono::Utc::now().to_rfc3339();

    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::context::update_context_unit(&conn, &updated)?;

    Ok(())
}
