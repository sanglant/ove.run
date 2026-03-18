use std::fs;
use std::path::Path;

/// Merges `"ove-run"` into `<project_path>/.claude/settings.local.json`.
/// Preserves all existing keys. Creates the file if it doesn't exist.
pub fn inject_mcp_config(project_path: &str, port: u16) -> Result<(), String> {
    let settings_path = Path::new(project_path)
        .join(".claude")
        .join("settings.local.json");

    let mut config: serde_json::Value = if settings_path.exists() {
        let raw = fs::read_to_string(&settings_path)
            .map_err(|e| format!("read settings.local.json: {e}"))?;
        serde_json::from_str(&raw).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers object exists, then insert only the ove-run key.
    if !config.get("mcpServers").map(|v| v.is_object()).unwrap_or(false) {
        config["mcpServers"] = serde_json::json!({});
    }
    config["mcpServers"]["ove-run"] = serde_json::json!({
        "url": format!("http://127.0.0.1:{}/mcp", port)
    });

    fs::create_dir_all(settings_path.parent().unwrap())
        .map_err(|e| format!("create .claude dir: {e}"))?;
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("serialize: {e}"))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("write settings.local.json: {e}"))?;

    Ok(())
}

/// Removes only the `"ove-run"` key from `mcpServers` in `settings.local.json`.
/// No-ops if the file doesn't exist or the key isn't present.
pub fn remove_mcp_config(project_path: &str) -> Result<(), String> {
    let settings_path = Path::new(project_path)
        .join(".claude")
        .join("settings.local.json");

    if !settings_path.exists() {
        return Ok(());
    }

    let raw = fs::read_to_string(&settings_path)
        .map_err(|e| format!("read: {e}"))?;
    let mut config: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(()), // malformed file — leave it alone
    };

    if let Some(servers) = config.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.remove("ove-run");
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("serialize: {e}"))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("write: {e}"))?;

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn inject_creates_file_when_none_exists() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 9000).unwrap();
        let path = dir.path().join(".claude/settings.local.json");
        assert!(path.exists());
        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(
            content["mcpServers"]["ove-run"]["url"],
            "http://127.0.0.1:9000/mcp"
        );
    }

    #[test]
    fn inject_preserves_existing_mcp_servers() {
        let dir = setup();
        let claude_dir = dir.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        let existing = serde_json::json!({
            "mcpServers": {
                "other-server": { "command": "my-mcp" }
            }
        });
        fs::write(
            claude_dir.join("settings.local.json"),
            serde_json::to_string_pretty(&existing).unwrap(),
        )
        .unwrap();

        inject_mcp_config(dir.path().to_str().unwrap(), 9001).unwrap();

        let content: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(claude_dir.join("settings.local.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(content["mcpServers"]["other-server"]["command"], "my-mcp");
        assert_eq!(
            content["mcpServers"]["ove-run"]["url"],
            "http://127.0.0.1:9001/mcp"
        );
    }

    #[test]
    fn inject_preserves_non_mcp_keys_in_file() {
        let dir = setup();
        let claude_dir = dir.path().join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        let existing = serde_json::json!({
            "theme": "dark",
            "permissions": ["read"]
        });
        fs::write(
            claude_dir.join("settings.local.json"),
            serde_json::to_string_pretty(&existing).unwrap(),
        )
        .unwrap();

        inject_mcp_config(dir.path().to_str().unwrap(), 9002).unwrap();

        let content: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(claude_dir.join("settings.local.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(content["theme"], "dark");
        assert!(content["permissions"].is_array());
        assert!(content["mcpServers"]["ove-run"].is_object());
    }

    #[test]
    fn remove_deletes_only_ove_run_key() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 9003).unwrap();
        let claude_dir = dir.path().join(".claude");
        let path = claude_dir.join("settings.local.json");
        let mut config: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        config["mcpServers"]["other"] = serde_json::json!({"command": "x"});
        fs::write(&path, serde_json::to_string_pretty(&config).unwrap()).unwrap();

        remove_mcp_config(dir.path().to_str().unwrap()).unwrap();

        let after: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert!(after["mcpServers"].get("ove-run").is_none());
        assert_eq!(after["mcpServers"]["other"]["command"], "x");
    }

    #[test]
    fn remove_is_noop_when_file_absent() {
        let dir = setup();
        remove_mcp_config(dir.path().to_str().unwrap()).unwrap();
    }
}
