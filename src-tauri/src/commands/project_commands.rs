use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::state::{AppState, Project};

fn projects_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base.join("com.agentic.app").join("projects.json"))
}

fn load_projects_from_disk() -> Vec<Project> {
    let path = match projects_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    if !path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    serde_json::from_str(&content).unwrap_or_default()
}

fn save_projects_to_disk(projects: &[Project]) -> Result<(), String> {
    let path = projects_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("Failed to serialize projects: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write projects: {}", e))
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let projects = state.projects.read().await;
    Ok(projects.clone())
}

#[tauri::command]
pub async fn add_project(
    state: State<'_, AppState>,
    name: String,
    path: String,
) -> Result<Project, String> {
    // Check if path is a git repo
    let git_enabled = std::path::Path::new(&path).join(".git").exists();

    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        created_at: Utc::now().to_rfc3339(),
        git_enabled,
        guardian_enabled: false,
        guardian_agent_type: None,
    };

    let mut projects = state.projects.write().await;
    projects.push(project.clone());
    save_projects_to_disk(&projects)?;

    Ok(project)
}

#[tauri::command]
pub async fn remove_project(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut projects = state.projects.write().await;

    let len_before = projects.len();
    projects.retain(|p| p.id != id);

    if projects.len() == len_before {
        return Err(format!("Project {} not found", id));
    }

    save_projects_to_disk(&projects)
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    updated_project: Project,
) -> Result<(), String> {
    let mut projects = state.projects.write().await;

    let pos = projects
        .iter()
        .position(|p| p.id == updated_project.id)
        .ok_or_else(|| format!("Project {} not found", updated_project.id))?;

    projects[pos] = updated_project;
    save_projects_to_disk(&projects)
}

/// Load persisted projects from disk. Called during app startup (sync).
pub fn load_projects_sync() -> Vec<Project> {
    load_projects_from_disk()
}

/// Run a one-shot guardian review using `claude -p <prompt>`.
/// This is non-interactive: the process receives the prompt, responds, and exits.
/// Returns the full stdout of the claude process.
#[tauri::command]
pub async fn guardian_review(prompt: String, project_path: String) -> Result<String, String> {
    let output = tokio::process::Command::new("claude")
        .arg("--dangerously-skip-permissions")
        .arg("-p")
        .arg(&prompt)
        .current_dir(&project_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run claude for guardian review: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 in guardian output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Guardian review process failed: {}", stderr))
    }
}
