use std::fs;
use std::path::Path;

/// Injects the ove-run MCP server entry into the appropriate config file for the given agent.
pub fn inject_mcp_config(project_path: &str, port: u16, agent_type: &str) -> Result<(), String> {
    match agent_type {
        "claude" => inject_claude_config(project_path, port),
        "gemini" => inject_gemini_config(project_path, port),
        "copilot" => inject_copilot_config(project_path, port),
        "codex" => inject_codex_config(project_path, port),
        _ => inject_claude_config(project_path, port), // default to Claude
    }
}

/// Removes only the ove-run MCP server entry from the appropriate config file.
pub fn remove_mcp_config(project_path: &str, agent_type: &str) -> Result<(), String> {
    match agent_type {
        "claude" => remove_claude_config(project_path),
        "gemini" => remove_gemini_config(project_path),
        "copilot" => remove_copilot_config(project_path),
        "codex" => remove_codex_config(project_path),
        _ => remove_claude_config(project_path),
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn mcp_url(port: u16) -> String {
    format!("http://127.0.0.1:{}/mcp", port)
}

/// Reads a JSON config file, returning an empty object if the file doesn't exist or is malformed.
fn read_json_config(path: &Path) -> serde_json::Value {
    if path.exists() {
        fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    }
}

/// Writes a JSON value to the given path, creating parent directories as needed.
fn write_json_config(path: &Path, config: &serde_json::Value) -> Result<(), String> {
    fs::create_dir_all(path.parent().unwrap())
        .map_err(|e| format!("create dir: {e}"))?;
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("serialize: {e}"))?;
    fs::write(path, content).map_err(|e| format!("write: {e}"))?;
    Ok(())
}

/// Injects "ove-run" into `mcpServers` in a JSON config and writes it back.
fn inject_json_mcp(path: &Path, entry: serde_json::Value) -> Result<(), String> {
    let mut config = read_json_config(path);
    if !config.get("mcpServers").map(|v| v.is_object()).unwrap_or(false) {
        config["mcpServers"] = serde_json::json!({});
    }
    config["mcpServers"]["ove-run"] = entry;
    write_json_config(path, &config)
}

/// Removes "ove-run" from `mcpServers` in a JSON config and writes it back.
fn remove_json_mcp(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(path).map_err(|e| format!("read: {e}"))?;
    let mut config: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(()), // malformed — leave it alone
    };
    if let Some(servers) = config.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.remove("ove-run");
    }
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("serialize: {e}"))?;
    fs::write(path, content).map_err(|e| format!("write: {e}"))?;
    Ok(())
}

// ── Claude ───────────────────────────────────────────────────────────────────

fn claude_config_path(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path)
        .join(".claude")
        .join("settings.local.json")
}

fn inject_claude_config(project_path: &str, port: u16) -> Result<(), String> {
    let path = claude_config_path(project_path);
    inject_json_mcp(&path, serde_json::json!({ "url": mcp_url(port) }))
}

fn remove_claude_config(project_path: &str) -> Result<(), String> {
    remove_json_mcp(&claude_config_path(project_path))
}

// ── Gemini ───────────────────────────────────────────────────────────────────

fn gemini_config_path(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path)
        .join(".gemini")
        .join("settings.json")
}

fn inject_gemini_config(project_path: &str, port: u16) -> Result<(), String> {
    let path = gemini_config_path(project_path);
    inject_json_mcp(&path, serde_json::json!({ "url": mcp_url(port) }))
}

fn remove_gemini_config(project_path: &str) -> Result<(), String> {
    remove_json_mcp(&gemini_config_path(project_path))
}

// ── Copilot ──────────────────────────────────────────────────────────────────

fn copilot_config_path(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path)
        .join(".copilot")
        .join("mcp-config.json")
}

fn inject_copilot_config(project_path: &str, port: u16) -> Result<(), String> {
    let path = copilot_config_path(project_path);
    inject_json_mcp(
        &path,
        serde_json::json!({ "type": "http", "url": mcp_url(port) }),
    )
}

fn remove_copilot_config(project_path: &str) -> Result<(), String> {
    remove_json_mcp(&copilot_config_path(project_path))
}

// ── Codex ────────────────────────────────────────────────────────────────────

fn codex_config_path(project_path: &str) -> std::path::PathBuf {
    Path::new(project_path).join(".codex").join("config.toml")
}

fn inject_codex_config(project_path: &str, port: u16) -> Result<(), String> {
    let path = codex_config_path(project_path);
    let mut config: toml::Value = if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| format!("read codex config: {e}"))?;
        toml::from_str(&raw).unwrap_or(toml::Value::Table(toml::map::Map::new()))
    } else {
        toml::Value::Table(toml::map::Map::new())
    };

    // Ensure mcp_servers table exists
    let root = config.as_table_mut().unwrap();
    if !root.contains_key("mcp_servers") {
        root.insert(
            "mcp_servers".to_string(),
            toml::Value::Table(toml::map::Map::new()),
        );
    }
    let mcp_servers = root
        .get_mut("mcp_servers")
        .unwrap()
        .as_table_mut()
        .unwrap();

    // Build the ove-run entry
    let mut entry = toml::map::Map::new();
    entry.insert(
        "type".to_string(),
        toml::Value::String("http".to_string()),
    );
    entry.insert("url".to_string(), toml::Value::String(mcp_url(port)));
    mcp_servers.insert("ove-run".to_string(), toml::Value::Table(entry));

    fs::create_dir_all(path.parent().unwrap())
        .map_err(|e| format!("create .codex dir: {e}"))?;
    let content = toml::to_string_pretty(&config).map_err(|e| format!("serialize toml: {e}"))?;
    fs::write(&path, content).map_err(|e| format!("write codex config: {e}"))?;
    Ok(())
}

fn remove_codex_config(project_path: &str) -> Result<(), String> {
    let path = codex_config_path(project_path);
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?;
    let mut config: toml::Value = match toml::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    if let Some(root) = config.as_table_mut() {
        if let Some(servers) = root.get_mut("mcp_servers").and_then(|v| v.as_table_mut()) {
            servers.remove("ove-run");
        }
    }

    let content = toml::to_string_pretty(&config).map_err(|e| format!("serialize: {e}"))?;
    fs::write(&path, content).map_err(|e| format!("write: {e}"))?;
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

    // ── Claude tests ─────────────────────────────────────────────────────

    #[test]
    fn inject_creates_file_when_none_exists() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 9000, "claude").unwrap();
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

        inject_mcp_config(dir.path().to_str().unwrap(), 9001, "claude").unwrap();

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

        inject_mcp_config(dir.path().to_str().unwrap(), 9002, "claude").unwrap();

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
        inject_mcp_config(dir.path().to_str().unwrap(), 9003, "claude").unwrap();
        let claude_dir = dir.path().join(".claude");
        let path = claude_dir.join("settings.local.json");
        let mut config: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        config["mcpServers"]["other"] = serde_json::json!({"command": "x"});
        fs::write(&path, serde_json::to_string_pretty(&config).unwrap()).unwrap();

        remove_mcp_config(dir.path().to_str().unwrap(), "claude").unwrap();

        let after: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert!(after["mcpServers"].get("ove-run").is_none());
        assert_eq!(after["mcpServers"]["other"]["command"], "x");
    }

    #[test]
    fn remove_is_noop_when_file_absent() {
        let dir = setup();
        remove_mcp_config(dir.path().to_str().unwrap(), "claude").unwrap();
    }

    // ── Gemini tests ─────────────────────────────────────────────────────

    #[test]
    fn gemini_inject_creates_config() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 8500, "gemini").unwrap();
        let path = dir.path().join(".gemini/settings.json");
        assert!(path.exists());
        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(
            content["mcpServers"]["ove-run"]["url"],
            "http://127.0.0.1:8500/mcp"
        );
    }

    #[test]
    fn gemini_remove_deletes_ove_run() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 8500, "gemini").unwrap();
        remove_mcp_config(dir.path().to_str().unwrap(), "gemini").unwrap();
        let path = dir.path().join(".gemini/settings.json");
        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        assert!(content["mcpServers"].get("ove-run").is_none());
    }

    // ── Copilot tests ────────────────────────────────────────────────────

    #[test]
    fn copilot_inject_creates_config_with_type() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 8600, "copilot").unwrap();
        let path = dir.path().join(".copilot/mcp-config.json");
        assert!(path.exists());
        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(content["mcpServers"]["ove-run"]["type"], "http");
        assert_eq!(
            content["mcpServers"]["ove-run"]["url"],
            "http://127.0.0.1:8600/mcp"
        );
    }

    // ── Codex tests ──────────────────────────────────────────────────────

    #[test]
    fn codex_inject_creates_toml_config() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 8700, "codex").unwrap();
        let path = dir.path().join(".codex/config.toml");
        assert!(path.exists());
        let content: toml::Value =
            toml::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        let servers = content.get("mcp_servers").unwrap().as_table().unwrap();
        let ove_run = servers.get("ove-run").unwrap().as_table().unwrap();
        assert_eq!(ove_run.get("type").unwrap().as_str().unwrap(), "http");
        assert_eq!(
            ove_run.get("url").unwrap().as_str().unwrap(),
            "http://127.0.0.1:8700/mcp"
        );
    }

    #[test]
    fn codex_remove_deletes_ove_run() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 8700, "codex").unwrap();
        remove_mcp_config(dir.path().to_str().unwrap(), "codex").unwrap();
        let path = dir.path().join(".codex/config.toml");
        let content: toml::Value =
            toml::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        let servers = content.get("mcp_servers").unwrap().as_table().unwrap();
        assert!(!servers.contains_key("ove-run"));
    }

    // ── Default agent type ───────────────────────────────────────────────

    #[test]
    fn unknown_agent_defaults_to_claude() {
        let dir = setup();
        inject_mcp_config(dir.path().to_str().unwrap(), 9100, "unknown-agent").unwrap();
        let path = dir.path().join(".claude/settings.local.json");
        assert!(path.exists());
    }
}
