use crate::notes::store;
use crate::state::ProjectNote;

fn validate_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} must not be empty", field))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn list_notes(project_id: String) -> Result<Vec<ProjectNote>, String> {
    validate_non_empty(&project_id, "project_id")?;
    store::list_notes(&project_id)
}

#[tauri::command]
pub async fn create_note(
    project_id: String,
    title: String,
    content: String,
) -> Result<ProjectNote, String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&title, "title")?;
    store::create_note(&project_id, &title, &content)
}

#[tauri::command]
pub async fn read_note_content(
    project_id: String,
    note_id: String,
) -> Result<String, String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    store::read_note(&project_id, &note_id)
}

#[tauri::command]
pub async fn update_note(
    project_id: String,
    note_id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    validate_non_empty(&title, "title")?;
    store::update_note(&project_id, &note_id, &title, &content)
}

#[tauri::command]
pub async fn delete_note(
    project_id: String,
    note_id: String,
) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&note_id, "note_id")?;
    store::delete_note(&project_id, &note_id)
}
