use crate::db::notes::Note;
use crate::error::{lock_err, AppError};
use crate::state::AppState;
use tauri::State;

fn validate_non_empty(value: &str, field: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        Err(AppError::Validation(format!("{} must not be empty", field)))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn list_notes(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Note>, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::notes::list_notes(&conn, &project_id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
    content: String,
) -> Result<Note, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&title, "title")?;
    let note = Note {
        id: uuid::Uuid::new_v4().to_string(),
        project_id,
        title,
        content,
        include_in_context: false,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::notes::create_note(&conn, &note)?;
    Ok(note)
}

#[tauri::command]
pub async fn read_note_content(
    state: State<'_, AppState>,
    project_id: String,
    note_id: String,
) -> Result<String, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    let conn = state.db.lock().map_err(lock_err)?;
    let note = crate::db::notes::read_note(&conn, &project_id, &note_id)?;
    Ok(note.content)
}

#[tauri::command]
pub async fn update_note(
    state: State<'_, AppState>,
    project_id: String,
    note_id: String,
    title: String,
    content: String,
) -> Result<(), AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    validate_non_empty(&title, "title")?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::notes::update_note(&conn, &note_id, &title, &content).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_note(
    state: State<'_, AppState>,
    project_id: String,
    note_id: String,
) -> Result<(), AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::notes::delete_note(&conn, &project_id, &note_id).map_err(Into::into)
}

#[tauri::command]
pub async fn set_note_context_toggle(
    state: State<'_, AppState>,
    project_id: String,
    note_id: String,
    include: bool,
) -> Result<(), AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::notes::set_include_in_context(&conn, &note_id, include).map_err(Into::into)
}
