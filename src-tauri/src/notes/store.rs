use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use uuid::Uuid;
use crate::state::ProjectNote;

fn notes_dir(project_id: &str) -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base
        .join("com.overun.app")
        .join("notes")
        .join(project_id))
}

fn manifest_path(project_id: &str) -> Result<PathBuf, String> {
    Ok(notes_dir(project_id)?.join("manifest.json"))
}

fn load_manifest(project_id: &str) -> Result<Vec<ProjectNote>, String> {
    let path = manifest_path(project_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read notes manifest: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse notes manifest: {}", e))
}

fn save_manifest(project_id: &str, entries: &[ProjectNote]) -> Result<(), String> {
    let dir = notes_dir(project_id)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create notes dir: {}", e))?;

    let path = manifest_path(project_id)?;
    let content = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Failed to serialize notes manifest: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write notes manifest: {}", e))
}

pub fn list_notes(project_id: &str) -> Result<Vec<ProjectNote>, String> {
    load_manifest(project_id)
}

pub fn create_note(
    project_id: &str,
    title: &str,
    content: &str,
) -> Result<ProjectNote, String> {
    let dir = notes_dir(project_id)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create notes dir: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let filename = format!("{}.md", id);
    let file_path = dir.join(&filename);

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write note file: {}", e))?;

    let entry = ProjectNote {
        id: id.clone(),
        project_id: project_id.to_string(),
        title: title.to_string(),
        file_path: file_path
            .to_str()
            .ok_or_else(|| "Invalid file path".to_string())?
            .to_string(),
        created_at: now.clone(),
        updated_at: now,
    };

    let mut entries = load_manifest(project_id)?;
    entries.push(entry.clone());
    save_manifest(project_id, &entries)?;

    Ok(entry)
}

pub fn read_note(project_id: &str, note_id: &str) -> Result<String, String> {
    let entries = load_manifest(project_id)?;
    let entry = entries
        .iter()
        .find(|e| e.id == note_id)
        .ok_or_else(|| format!("Note {} not found", note_id))?;

    fs::read_to_string(&entry.file_path)
        .map_err(|e| format!("Failed to read note file: {}", e))
}

pub fn update_note(
    project_id: &str,
    note_id: &str,
    title: &str,
    content: &str,
) -> Result<(), String> {
    let mut entries = load_manifest(project_id)?;
    let entry = entries
        .iter_mut()
        .find(|e| e.id == note_id)
        .ok_or_else(|| format!("Note {} not found", note_id))?;

    fs::write(&entry.file_path, content)
        .map_err(|e| format!("Failed to write note file: {}", e))?;

    entry.title = title.to_string();
    entry.updated_at = Utc::now().to_rfc3339();
    save_manifest(project_id, &entries)
}

pub fn delete_note(project_id: &str, note_id: &str) -> Result<(), String> {
    let mut entries = load_manifest(project_id)?;
    let pos = entries
        .iter()
        .position(|e| e.id == note_id)
        .ok_or_else(|| format!("Note {} not found", note_id))?;

    let entry = entries.remove(pos);

    if std::path::Path::new(&entry.file_path).exists() {
        fs::remove_file(&entry.file_path)
            .map_err(|e| format!("Failed to delete note file: {}", e))?;
    }

    save_manifest(project_id, &entries)
}
