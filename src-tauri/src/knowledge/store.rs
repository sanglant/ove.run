use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use uuid::Uuid;
use crate::state::KnowledgeEntry;

fn knowledge_dir(project_id: &str) -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base
        .join("com.overun.app")
        .join("knowledge")
        .join(project_id))
}

fn manifest_path(project_id: &str) -> Result<PathBuf, String> {
    Ok(knowledge_dir(project_id)?.join("manifest.json"))
}

fn load_manifest(project_id: &str) -> Result<Vec<KnowledgeEntry>, String> {
    let path = manifest_path(project_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest: {}", e))
}

fn save_manifest(project_id: &str, entries: &[KnowledgeEntry]) -> Result<(), String> {
    let dir = knowledge_dir(project_id)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create knowledge dir: {}", e))?;

    let path = manifest_path(project_id)?;
    let content = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write manifest: {}", e))
}

pub fn list_knowledge(project_id: &str) -> Result<Vec<KnowledgeEntry>, String> {
    load_manifest(project_id)
}

pub fn create_knowledge(
    project_id: &str,
    name: &str,
    content_type: &str,
    content: &str,
) -> Result<KnowledgeEntry, String> {
    let dir = knowledge_dir(project_id)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create knowledge dir: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let filename = format!("{}.txt", id);
    let file_path = dir.join(&filename);

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write knowledge file: {}", e))?;

    let entry = KnowledgeEntry {
        id: id.clone(),
        project_id: project_id.to_string(),
        name: name.to_string(),
        file_path: file_path
            .to_str()
            .ok_or_else(|| "Invalid file path".to_string())?
            .to_string(),
        content_type: content_type.to_string(),
        created_at: now.clone(),
        updated_at: now,
    };

    let mut entries = load_manifest(project_id)?;
    entries.push(entry.clone());
    save_manifest(project_id, &entries)?;

    Ok(entry)
}

pub fn read_knowledge(project_id: &str, knowledge_id: &str) -> Result<String, String> {
    let entries = load_manifest(project_id)?;
    let entry = entries
        .iter()
        .find(|e| e.id == knowledge_id)
        .ok_or_else(|| format!("Knowledge entry {} not found", knowledge_id))?;

    fs::read_to_string(&entry.file_path)
        .map_err(|e| format!("Failed to read knowledge file: {}", e))
}

pub fn update_knowledge(
    project_id: &str,
    knowledge_id: &str,
    content: &str,
) -> Result<(), String> {
    let mut entries = load_manifest(project_id)?;
    let entry = entries
        .iter_mut()
        .find(|e| e.id == knowledge_id)
        .ok_or_else(|| format!("Knowledge entry {} not found", knowledge_id))?;

    fs::write(&entry.file_path, content)
        .map_err(|e| format!("Failed to write knowledge file: {}", e))?;

    entry.updated_at = Utc::now().to_rfc3339();
    save_manifest(project_id, &entries)
}

pub fn delete_knowledge(project_id: &str, knowledge_id: &str) -> Result<(), String> {
    let mut entries = load_manifest(project_id)?;
    let pos = entries
        .iter()
        .position(|e| e.id == knowledge_id)
        .ok_or_else(|| format!("Knowledge entry {} not found", knowledge_id))?;

    let entry = entries.remove(pos);

    // Delete the physical file
    if std::path::Path::new(&entry.file_path).exists() {
        fs::remove_file(&entry.file_path)
            .map_err(|e| format!("Failed to delete knowledge file: {}", e))?;
    }

    save_manifest(project_id, &entries)
}
