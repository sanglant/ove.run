use crate::error::{lock_err, AppError};
use crate::state::{AppState, Project};
use chrono::Utc;
use std::time::Duration;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, AppError> {
    let projects = state.projects.read().await;
    Ok(projects.clone())
}

#[tauri::command]
pub async fn add_project(
    state: State<'_, AppState>,
    name: String,
    path: String,
) -> Result<Project, AppError> {
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

    {
        let conn = state.db.lock().map_err(lock_err)?;
        crate::db::projects::insert_project(&conn, &project)?;
    }

    let mut projects = state.projects.write().await;
    projects.push(project.clone());

    Ok(project)
}

#[tauri::command]
pub async fn remove_project(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    {
        let conn = state.db.lock().map_err(lock_err)?;
        crate::db::projects::delete_project(&conn, &id)?;
    }

    let mut projects = state.projects.write().await;
    let len_before = projects.len();
    projects.retain(|p| p.id != id);

    if projects.len() == len_before {
        return Err(AppError::NotFound(format!("Project {} not found", id)));
    }

    Ok(())
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    updated_project: Project,
) -> Result<(), AppError> {
    {
        let conn = state.db.lock().map_err(lock_err)?;
        crate::db::projects::update_project(&conn, &updated_project)?;
    }

    let mut projects = state.projects.write().await;
    let pos = projects
        .iter()
        .position(|p| p.id == updated_project.id)
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", updated_project.id)))?;

    projects[pos] = updated_project;
    Ok(())
}

#[tauri::command]
pub async fn list_project_files(
    project_path: String,
    max_files: Option<usize>,
) -> Result<Vec<String>, AppError> {
    use ignore::WalkBuilder;
    use std::path::Path;

    let root = Path::new(&project_path);
    if !root.is_dir() {
        return Err(AppError::Other(format!(
            "Not a directory: {}",
            project_path
        )));
    }

    let limit = max_files.unwrap_or(5000);
    let mut files: Vec<String> = Vec::new();

    let walker = WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .max_depth(Some(8))
        .build();

    for entry in walker {
        if files.len() >= limit {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.path() == root {
            continue;
        }
        if let Ok(rel) = entry.path().strip_prefix(root) {
            files.push(rel.to_string_lossy().to_string());
        }
    }

    files.sort();
    Ok(files)
}

/// Core arbiter CLI subprocess call — usable without Tauri State.
/// Runs the CLI tool with `-p <prompt>` in a temp directory.
/// `timeout_seconds` caps how long the subprocess may run; 0 means no cap.
pub async fn run_arbiter_cli(
    prompt: &str,
    project_path: &str,
    cli_command: &str,
    model: Option<&str>,
    timeout_seconds: u64,
) -> Result<String, AppError> {
    let tmp_dir = tempfile::tempdir()
        .map_err(|e| AppError::Other(format!("Failed to create temp dir for arbiter: {}", e)))?;

    let mut cmd = tokio::process::Command::new(cli_command);
    if cli_command == "claude" {
        cmd.arg("--dangerously-skip-permissions");
        cmd.arg("--no-session-persistence");
    }
    if let Some(m) = model {
        if !m.is_empty() {
            cmd.arg("--model").arg(m);
        }
    }
    let full_prompt = format!("Project path: {}\n\n{}", project_path, prompt);
    cmd.arg("-p").arg(&full_prompt).current_dir(tmp_dir.path());

    let output = if timeout_seconds > 0 {
        tokio::time::timeout(Duration::from_secs(timeout_seconds), cmd.output())
            .await
            .map_err(|_| {
                AppError::Other(format!("Arbiter CLI timed out after {}s", timeout_seconds))
            })?
            .map_err(|e| {
                AppError::Other(format!(
                    "Failed to run {} for arbiter review: {}",
                    cli_command, e
                ))
            })?
    } else {
        cmd.output().await.map_err(|e| {
            AppError::Other(format!(
                "Failed to run {} for arbiter review: {}",
                cli_command, e
            ))
        })?
    };

    if output.status.success() {
        let raw = String::from_utf8(output.stdout)
            .map_err(|e| AppError::Other(format!("Invalid UTF-8 in arbiter output: {}", e)))?;
        // Strip ANSI escape codes from CLI tool output before parsing
        let clean = strip_ansi_escapes::strip(raw.as_bytes());
        Ok(String::from_utf8_lossy(&clean).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::Other(format!(
            "Arbiter review process failed: {}",
            stderr
        )))
    }
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
) -> Result<String, AppError> {
    let command = cli_command.unwrap_or_else(|| "claude".to_string());
    run_arbiter_cli(&prompt, &project_path, &command, model.as_deref(), 120).await
}

/// Return known model aliases and IDs for a given CLI agent tool.
/// Uses official documentation as source for aliases.
#[tauri::command]
pub async fn list_cli_models(cli_command: String) -> Result<Vec<String>, AppError> {
    let cmd = cli_command.split_whitespace().next().unwrap_or("claude");

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
