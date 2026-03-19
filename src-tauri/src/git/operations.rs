use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub files: Vec<GitFileStatus>,
    pub ahead: i32,
    pub behind: i32,
}

pub fn git_status(cwd: &str) -> Result<GitStatus, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v2", "--branch"])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Ok(GitStatus {
            is_repo: false,
            branch: String::new(),
            files: Vec::new(),
            ahead: 0,
            behind: 0,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branch = String::new();
    let mut ahead = 0i32;
    let mut behind = 0i32;
    let mut files = Vec::new();

    for line in stdout.lines() {
        if line.starts_with("# branch.head ") {
            branch = line
                .strip_prefix("# branch.head ")
                .unwrap_or("(unknown)")
                .to_string();
        } else if line.starts_with("# branch.ab ") {
            // Format: # branch.ab +N -M
            if let Some(ab) = line.strip_prefix("# branch.ab ") {
                let parts: Vec<&str> = ab.split_whitespace().collect();
                if parts.len() >= 2 {
                    ahead = parts[0].trim_start_matches('+').parse().unwrap_or(0);
                    behind = parts[1]
                        .trim_start_matches('-')
                        .parse::<i32>()
                        .unwrap_or(0)
                        .abs();
                }
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            // Ordinary / renamed changed entry
            // Format: 1 XY sub mH mI mW hH hI path
            let parts: Vec<&str> = line.splitn(9, ' ').collect();
            if parts.len() >= 9 {
                let xy = parts[1];
                let path = parts[8].to_string();
                let staged_char = xy.chars().next().unwrap_or('.');
                let unstaged_char = xy.chars().nth(1).unwrap_or('.');

                if staged_char != '.' {
                    files.push(GitFileStatus {
                        path: path.clone(),
                        status: staged_char.to_string(),
                        staged: true,
                    });
                }
                if unstaged_char != '.' {
                    files.push(GitFileStatus {
                        path: path.clone(),
                        status: unstaged_char.to_string(),
                        staged: false,
                    });
                }
            }
        } else if let Some(stripped) = line.strip_prefix("? ") {
            // Untracked
            let path = stripped.to_string();
            files.push(GitFileStatus {
                path,
                status: "?".to_string(),
                staged: false,
            });
        } else if line.starts_with("! ") {
            // Ignored - skip
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        files,
        ahead,
        behind,
    })
}

pub fn git_diff(cwd: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--staged");
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn git_diff_file(cwd: &str, file_path: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--staged");
    }
    args.push("--");
    args.push(file_path);

    let output = Command::new("git")
        .args(&args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn git_stage(cwd: &str, files: Vec<String>) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }

    let output = Command::new("git")
        .arg("add")
        .arg("--")
        .args(&files)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

pub fn git_unstage(cwd: &str, files: Vec<String>) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }

    let output = Command::new("git")
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .args(&files)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git restore: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

pub fn git_commit(cwd: &str, message: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // Get the commit hash
    let hash_output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to get commit hash: {}", e))?;

    Ok(String::from_utf8_lossy(&hash_output.stdout)
        .trim()
        .to_string())
}
