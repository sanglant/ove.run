use std::fs;
use std::path::PathBuf;

use super::provider::{ProviderAuth, ProviderConfig};

pub fn get_bugs_dir(project_id: &str) -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("com.overun.app").join("bugs").join(project_id)
}

pub fn save_provider_config(project_id: &str, config: &ProviderConfig) -> Result<(), String> {
    let dir = get_bugs_dir(project_id);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create bugs dir: {}", e))?;

    let path = dir.join("config.json");
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize provider config: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write provider config: {}", e))
}

pub fn load_provider_config(project_id: &str) -> Result<Option<ProviderConfig>, String> {
    let path = get_bugs_dir(project_id).join("config.json");
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read provider config: {}", e))?;

    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("Failed to parse provider config: {}", e))
}

pub fn save_provider_auth(project_id: &str, auth: &ProviderAuth) -> Result<(), String> {
    let dir = get_bugs_dir(project_id);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create bugs dir: {}", e))?;

    let path = dir.join("auth.json");
    let content = serde_json::to_string_pretty(auth)
        .map_err(|e| format!("Failed to serialize provider auth: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write provider auth: {}", e))
}

pub fn load_provider_auth(project_id: &str) -> Result<Option<ProviderAuth>, String> {
    let path = get_bugs_dir(project_id).join("auth.json");
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read provider auth: {}", e))?;

    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("Failed to parse provider auth: {}", e))
}

pub fn delete_provider_data(project_id: &str) -> Result<(), String> {
    let dir = get_bugs_dir(project_id);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("Failed to delete provider data: {}", e))?;
    }
    Ok(())
}
