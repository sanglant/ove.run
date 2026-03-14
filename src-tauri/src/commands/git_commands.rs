use crate::error::AppError;
use crate::git::operations::{self, GitStatus};

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, AppError> {
    operations::git_status(&path).map_err(AppError::Git)
}

#[tauri::command]
pub async fn git_diff(path: String, staged: bool) -> Result<String, AppError> {
    operations::git_diff(&path, staged).map_err(AppError::Git)
}

#[tauri::command]
pub async fn git_diff_file(
    path: String,
    file_path: String,
    staged: bool,
) -> Result<String, AppError> {
    operations::git_diff_file(&path, &file_path, staged).map_err(AppError::Git)
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), AppError> {
    operations::git_stage(&path, files).map_err(AppError::Git)
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), AppError> {
    operations::git_unstage(&path, files).map_err(AppError::Git)
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, AppError> {
    operations::git_commit(&path, message).map_err(AppError::Git)
}
