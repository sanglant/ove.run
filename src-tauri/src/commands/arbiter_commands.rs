use tauri::State;
use uuid::Uuid;
use chrono::Utc;
use crate::error::{AppError, lock_err};
use crate::state::{AppState, ArbiterStateRow, Story, TrustLevel};
use crate::db::{arbiter_state, stories, context, memory};
use crate::arbiter::actions::ArbiterAction;
use crate::arbiter::dispatch;

#[tauri::command]
pub async fn get_arbiter_state(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Option<ArbiterStateRow>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    arbiter_state::get_arbiter_state(&conn, &project_id).map_err(Into::into)
}

#[tauri::command]
pub async fn set_trust_level(
    state: State<'_, AppState>,
    project_id: String,
    level: i32,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    if arbiter_state::get_arbiter_state(&conn, &project_id)?.is_none() {
        let default = ArbiterStateRow {
            project_id: project_id.clone(),
            trust_level: TrustLevel::from_i32(level),
            loop_status: "idle".to_string(),
            current_story_id: None,
            iteration_count: 0,
            max_iterations: 50,
            last_activity_at: None,
        };
        arbiter_state::upsert_arbiter_state(&conn, &default)?;
    } else {
        arbiter_state::set_trust_level(&conn, &project_id, TrustLevel::from_i32(level))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn decompose_request(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    user_request: String,
) -> Result<Vec<Story>, AppError> {
    // 1. Load project-specific context units (exclude bundled globals to avoid
    //    over-decomposition — bundled personas/skills cause the arbiter to
    //    generate irrelevant stories like "add ESLint" for a "hello world" task).
    let (context_units, memories_list) = {
        let conn = state.db.lock().map_err(lock_err)?;
        let all_ctx = context::list_context_units(&conn, Some(&project_id))?;
        let ctx: Vec<_> = all_ctx.into_iter().filter(|u| !u.is_bundled).collect();
        let mems = memory::search_memories(&conn, &user_request, &project_id, None, 10)?;
        (ctx, mems)
    };

    // 2. Resolve CLI settings
    let (cli_command, model) = {
        let settings = state.settings.read().await;
        let provider = &settings.global.arbiter_provider;
        let cmd = if provider.is_empty() {
            "claude".to_string()
        } else {
            provider.clone()
        };
        let m = &settings.global.arbiter_model;
        (cmd, if m.is_empty() { None } else { Some(m.clone()) })
    };

    // 3. Dispatch DecomposeRequest action
    let action = ArbiterAction::DecomposeRequest {
        user_request,
        project_context: context_units,
        memories: memories_list,
    };
    let response =
        dispatch::dispatch(action, &project_path, &cli_command, model.as_deref())
            .await
            .map_err(AppError::Other)?;

    // 4. Convert StoryDrafts to Stories and save
    let drafts = response.stories.unwrap_or_default();
    let now = Utc::now().to_rfc3339();
    let mut created_stories = Vec::new();

    // First pass: assign IDs, build title -> id map for depends_on resolution
    let mut title_to_id: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for draft in &drafts {
        let id = Uuid::new_v4().to_string();
        title_to_id.insert(draft.title.clone(), id);
    }

    for draft in &drafts {
        let depends_on_ids: Vec<String> = draft
            .depends_on
            .iter()
            .filter_map(|t| title_to_id.get(t).cloned())
            .collect();

        let story = Story {
            id: title_to_id.get(&draft.title).unwrap().clone(),
            project_id: project_id.clone(),
            title: draft.title.clone(),
            description: draft.description.clone(),
            acceptance_criteria: Some(draft.acceptance_criteria.clone()),
            priority: draft.priority,
            status: "pending".to_string(),
            depends_on_json: serde_json::to_string(&depends_on_ids)
                .unwrap_or_else(|_| "[]".to_string()),
            iteration_attempts: 0,
            created_at: now.clone(),
        };
        created_stories.push(story);
    }

    // Save to DB
    {
        let conn = state.db.lock().map_err(lock_err)?;
        stories::create_stories_batch(&conn, &created_stories)?;
        arbiter_state::set_loop_status(&conn, &project_id, "planning")?;
    }

    Ok(created_stories)
}

#[tauri::command]
pub async fn list_stories(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Story>, AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    stories::list_stories(&conn, &project_id).map_err(Into::into)
}

#[tauri::command]
pub async fn update_story(state: State<'_, AppState>, story: Story) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    stories::update_story(&conn, &story).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_story(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    stories::delete_story(&conn, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn reorder_stories(
    state: State<'_, AppState>,
    project_id: String,
    story_ids: Vec<String>,
) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(lock_err)?;
    // First = highest priority (longest distance from 0)
    for (i, id) in story_ids.iter().enumerate() {
        let priority = (story_ids.len() - i) as i32;
        if let Ok(mut story) = stories::get_story(&conn, id) {
            story.priority = priority;
            stories::update_story(&conn, &story)?;
        }
    }
    // Suppress unused variable warning from project_id (kept for API clarity)
    let _ = project_id;
    Ok(())
}
