pub mod policy;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// What sandbox backends are available on this system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxCapabilities {
    pub platform: String,
    pub available: bool,
    pub backend: Option<String>,
    pub detail: String,
}

/// Wraps a command + args + env for sandboxed execution.
/// On unsupported platforms, returns the inputs unchanged.
pub fn wrap_command(
    trust_level: u32,
    project_path: &str,
    command: &str,
    args: &[String],
    env: &HashMap<String, String>,
) -> (String, Vec<String>, HashMap<String, String>) {
    #[cfg(target_os = "linux")]
    {
        if linux::is_available() {
            return linux::wrap_command(trust_level, project_path, command, args, env);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if macos::is_available() {
            return macos::wrap_command(trust_level, project_path, command, args, env);
        }
    }

    // Fallback: no sandboxing
    (command.to_string(), args.to_vec(), env.clone())
}

/// Detect what sandbox capabilities are available on this system.
pub fn detect_capabilities() -> SandboxCapabilities {
    #[cfg(target_os = "linux")]
    {
        if linux::is_available() {
            return SandboxCapabilities {
                platform: "linux".into(),
                available: true,
                backend: Some("bubblewrap".into()),
                detail: "bubblewrap (bwrap) detected — namespace + filesystem isolation".into(),
            };
        }
        SandboxCapabilities {
            platform: "linux".into(),
            available: false,
            backend: None,
            detail: "Install bubblewrap for agent sandboxing: sudo apt install bubblewrap".into(),
        }
    }

    #[cfg(target_os = "macos")]
    {
        if macos::is_available() {
            return SandboxCapabilities {
                platform: "macos".into(),
                available: true,
                backend: Some("seatbelt".into()),
                detail: "sandbox-exec (Seatbelt) available — filesystem + network isolation".into(),
            };
        }
        return SandboxCapabilities {
            platform: "macos".into(),
            available: false,
            backend: None,
            detail: "sandbox-exec not found on this system".into(),
        };
    }

    #[cfg(target_os = "windows")]
    {
        return SandboxCapabilities {
            platform: "windows".into(),
            available: false,
            backend: None,
            detail: "Agent sandboxing is not yet supported on Windows. Use WSL2 for isolation."
                .into(),
        };
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        SandboxCapabilities {
            platform: std::env::consts::OS.into(),
            available: false,
            backend: None,
            detail: "Unsupported platform for agent sandboxing".into(),
        }
    }
}
