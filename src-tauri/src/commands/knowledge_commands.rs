use crate::knowledge::store;
use crate::state::KnowledgeEntry;

#[tauri::command]
pub async fn list_knowledge(project_id: String) -> Result<Vec<KnowledgeEntry>, String> {
    store::list_knowledge(&project_id)
}

#[tauri::command]
pub async fn create_knowledge(
    project_id: String,
    name: String,
    content_type: String,
    content: String,
) -> Result<KnowledgeEntry, String> {
    store::create_knowledge(&project_id, &name, &content_type, &content)
}

#[tauri::command]
pub async fn read_knowledge_content(
    project_id: String,
    knowledge_id: String,
) -> Result<String, String> {
    store::read_knowledge(&project_id, &knowledge_id)
}

#[tauri::command]
pub async fn update_knowledge(
    project_id: String,
    knowledge_id: String,
    content: String,
) -> Result<(), String> {
    store::update_knowledge(&project_id, &knowledge_id, &content)
}

#[tauri::command]
pub async fn delete_knowledge(
    project_id: String,
    knowledge_id: String,
) -> Result<(), String> {
    store::delete_knowledge(&project_id, &knowledge_id)
}
