use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::state::AgentType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: String,
    pub project_id: String,
    pub agent_type: AgentType,
    pub yolo_mode: bool,
    pub label: String,
    pub created_at: String,
}

fn sessions_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base.join("com.agentic.app").join("sessions.json"))
}

pub fn load_sessions() -> Vec<PersistedSession> {
    match try_load_sessions() {
        Ok(sessions) => sessions,
        Err(_) => vec![],
    }
}

fn try_load_sessions() -> Result<Vec<PersistedSession>, String> {
    let path = sessions_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read sessions: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse sessions: {}", e))
}

pub fn save_sessions(sessions: &[PersistedSession]) -> Result<(), String> {
    let path = sessions_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create sessions directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write sessions: {}", e))
}
