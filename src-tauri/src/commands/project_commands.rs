use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::state::{AppState, Project};

fn projects_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base.join("com.overun.app").join("projects.json"))
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
        arbiter_enabled: false,
        arbiter_agent_type: None,
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

/// Run a one-shot arbiter review using a CLI agent tool with `-p <prompt>`.
/// This is non-interactive: the process receives the prompt, responds, and exits.
/// Runs in a temporary directory so sessions don't pollute the project's resume list.
/// Returns the full stdout of the process.
#[tauri::command]
pub async fn arbiter_review(
    prompt: String,
    project_path: String,
    cli_command: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let command = cli_command.unwrap_or_else(|| "claude".to_string());

    // Run in a temp directory so the arbiter session won't appear in any
    // project's resume/session list (most CLI agents scope sessions by cwd).
    let tmp_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create temp dir for arbiter: {}", e))?;

    let mut cmd = tokio::process::Command::new(&command);
    // Only add claude-specific flags
    if command == "claude" {
        cmd.arg("--dangerously-skip-permissions");
        cmd.arg("--no-session-persistence");
    }
    if let Some(ref m) = model {
        if !m.is_empty() {
            cmd.arg("--model").arg(m);
        }
    }
    let full_prompt = format!("Project path: {}\n\n{}", project_path, prompt);
    cmd.arg("-p").arg(&full_prompt).current_dir(tmp_dir.path());

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run {} for arbiter review: {}", command, e))?;

    // tmp_dir is dropped here, cleaning up automatically

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 in arbiter output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Arbiter review process failed: {}", stderr))
    }
}

/// Return known model aliases and IDs for a given CLI agent tool.
/// Uses official documentation as source for aliases.
#[tauri::command]
pub async fn list_cli_models(cli_command: String) -> Result<Vec<String>, String> {
    let cmd = cli_command.trim().split_whitespace().next().unwrap_or("claude");

    match cmd {
        "claude" => Ok(vec![
            "sonnet".to_string(),
            "opus".to_string(),
            "haiku".to_string(),
            "opusplan".to_string(),
        ]),
        "gemini" => Ok(vec![
            "auto".to_string(),
            "pro".to_string(),
            "flash".to_string(),
            "flash-lite".to_string(),
        ]),
        // Copilot and Codex: no stable aliases, use CLI default
        "copilot" | "codex" => Ok(vec![]),
        _ => Ok(vec![]),
    }
}
