use crate::knowledge::store;
use crate::state::KnowledgeEntry;

const ALLOWED_CONTENT_TYPES: &[&str] = &["system_prompt", "context_file", "notes"];

fn validate_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} must not be empty", field))
    } else {
        Ok(())
    }
}

fn validate_content_type(content_type: &str) -> Result<(), String> {
    if ALLOWED_CONTENT_TYPES.contains(&content_type) {
        Ok(())
    } else {
        Err(format!(
            "Invalid content_type '{}'. Allowed values: {}",
            content_type,
            ALLOWED_CONTENT_TYPES.join(", ")
        ))
    }
}

#[tauri::command]
pub async fn list_knowledge(project_id: String) -> Result<Vec<KnowledgeEntry>, String> {
    validate_non_empty(&project_id, "project_id")?;
    store::list_knowledge(&project_id)
}

#[tauri::command]
pub async fn create_knowledge(
    project_id: String,
    name: String,
    content_type: String,
    content: String,
) -> Result<KnowledgeEntry, String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&name, "name")?;
    validate_content_type(&content_type)?;
    store::create_knowledge(&project_id, &name, &content_type, &content)
}

#[tauri::command]
pub async fn read_knowledge_content(
    project_id: String,
    knowledge_id: String,
) -> Result<String, String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&knowledge_id, "knowledge_id")?;
    store::read_knowledge(&project_id, &knowledge_id)
}

#[tauri::command]
pub async fn update_knowledge(
    project_id: String,
    knowledge_id: String,
    content: String,
) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&knowledge_id, "knowledge_id")?;
    store::update_knowledge(&project_id, &knowledge_id, &content)
}

#[tauri::command]
pub async fn delete_knowledge(
    project_id: String,
    knowledge_id: String,
) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&knowledge_id, "knowledge_id")?;
    store::delete_knowledge(&project_id, &knowledge_id)
}
