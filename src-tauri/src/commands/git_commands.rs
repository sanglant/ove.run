use crate::git::operations::{self, GitStatus};

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    operations::git_status(&path)
}

#[tauri::command]
pub async fn git_diff(path: String, staged: bool) -> Result<String, String> {
    operations::git_diff(&path, staged)
}

#[tauri::command]
pub async fn git_diff_file(
    path: String,
    file_path: String,
    staged: bool,
) -> Result<String, String> {
    operations::git_diff_file(&path, &file_path, staged)
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    operations::git_stage(&path, files)
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    operations::git_unstage(&path, files)
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    operations::git_commit(&path, message)
}
