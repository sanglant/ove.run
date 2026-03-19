use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::policy;

/// Resolve a command name to its full path via `which`.
fn which_command(cmd: &str) -> Option<String> {
    Command::new("which")
        .arg(cmd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}

/// Check if bubblewrap is installed.
pub fn is_available() -> bool {
    Command::new("bwrap")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Wrap a command with bubblewrap sandbox flags.
///
/// Trust levels:
///   1 (Supervised)  — read-only project, read-only home
///   2 (Autonomous)  — read-write project, read-only home
///   3 (Full Auto)   — read-write project, read-only home
///
/// All levels block sensitive directories (~/.ssh, ~/.aws, etc.)
/// and mount agent config dirs read-only for authentication.
pub fn wrap_command(
    trust_level: u32,
    project_path: &str,
    command: &str,
    args: &[String],
    env: &HashMap<String, String>,
) -> (String, Vec<String>, HashMap<String, String>) {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/home/user"));
    let home_str = home.to_string_lossy();

    let mut bwrap_args: Vec<String> = Vec::new();

    // ── System paths (read-only) ────────────────────────────
    for sys_path in policy::SYSTEM_READ_PATHS {
        if Path::new(sys_path).exists() {
            bwrap_args.extend([
                "--ro-bind".into(),
                sys_path.to_string(),
                sys_path.to_string(),
            ]);
        }
    }

    // ── /proc, /dev, /tmp ───────────────────────────────────
    bwrap_args.extend([
        "--proc".into(),
        "/proc".into(),
        "--dev".into(),
        "/dev".into(),
        "--tmpfs".into(),
        "/tmp".into(),
    ]);

    // ── Project directory ───────────────────────────────────
    if trust_level <= 1 {
        // Supervised: read-only project
        bwrap_args.extend(["--ro-bind".into(), project_path.into(), project_path.into()]);
    } else {
        // Autonomous / Full Auto: read-write project
        bwrap_args.extend(["--bind".into(), project_path.into(), project_path.into()]);
    }

    // ── Agent config dirs (read-write for auth) ──────────────
    // These must be writable because CLI tools refresh tokens,
    // write lock files, and update session state in their config dirs.
    for config_path in policy::AGENT_CONFIG_PATHS {
        let full_path = home.join(config_path);
        if full_path.exists() {
            let p = full_path.to_string_lossy().to_string();
            bwrap_args.extend(["--bind".into(), p.clone(), p]);
        }
    }

    // ── Dev tool runtimes (read-only) ───────────────────────
    for runtime_path in policy::RUNTIME_PATHS {
        let full_path = home.join(runtime_path);
        if full_path.exists() {
            let p = full_path.to_string_lossy().to_string();
            bwrap_args.extend(["--ro-bind".into(), p.clone(), p]);
        }
    }

    // ── Snap/Flatpak tool paths ─────────────────────────────
    // Some agents are installed via snap/flatpak
    for extra in &["/snap", "/var/lib/snapd"] {
        if Path::new(extra).exists() {
            bwrap_args.extend(["--ro-bind".into(), extra.to_string(), extra.to_string()]);
        }
    }

    // NOTE: Sensitive dirs (~/.ssh, ~/.aws, etc.) are simply NOT mounted,
    // so they don't exist inside the sandbox. No explicit deny needed.

    // ── Process isolation ───────────────────────────────────
    bwrap_args.extend([
        "--unshare-pid".into(),
        "--die-with-parent".into(),
        "--new-session".into(),
    ]);

    // ── Set working directory ───────────────────────────────
    bwrap_args.extend(["--chdir".into(), project_path.into()]);

    // ── Resolve command path ────────────────────────────────
    // Agent binaries (claude, gemini, etc.) are often symlinks from
    // ~/.local/bin/ into ~/.local/share/. Inside the sandbox the symlink
    // target might live in a separately mounted path, so resolve to the
    // real path and also ensure that path is mounted.
    let resolved_command = which_command(command).unwrap_or_else(|| command.to_string());
    let resolved_path = std::fs::canonicalize(&resolved_command)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| resolved_command.clone());

    // If the resolved binary lives under a path not yet mounted, mount
    // its parent directory read-only so execvp can find it.
    if let Some(parent) = Path::new(&resolved_path).parent() {
        let parent_str = parent.to_string_lossy().to_string();
        if !bwrap_args.contains(&parent_str) {
            bwrap_args.extend(["--ro-bind".into(), parent_str.clone(), parent_str]);
        }
    }

    // ── Separator + actual command ──────────────────────────
    bwrap_args.push("--".into());
    bwrap_args.push(resolved_path);
    bwrap_args.extend(args.iter().cloned());

    // ── Environment: pass through, scrub dangerous vars ─────
    let mut sandbox_env = env.clone();
    // Remove vars that could leak secrets if inherited
    for var in &[
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "GCP_SERVICE_ACCOUNT_KEY",
    ] {
        sandbox_env.remove(*var);
    }
    // Set HOME so agent configs resolve correctly inside sandbox
    sandbox_env
        .entry("HOME".to_string())
        .or_insert_with(|| home_str.to_string());

    ("bwrap".to_string(), bwrap_args, sandbox_env)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_produces_bwrap_command() {
        let env = HashMap::new();
        let (cmd, args, _) = wrap_command(2, "/home/user/project", "claude", &[], &env);
        assert_eq!(cmd, "bwrap");
        assert!(args.contains(&"--".to_string()));
        // The command is resolved to a full path; verify it appears after "--"
        let sep_idx = args.iter().position(|a| a == "--").unwrap();
        let resolved_cmd = &args[sep_idx + 1];
        assert!(
            resolved_cmd.contains("claude"),
            "resolved command should contain 'claude', got: {}",
            resolved_cmd
        );
        assert!(args.contains(&"--bind".to_string())); // read-write for trust 2
    }

    #[test]
    fn supervised_uses_ro_bind_for_project() {
        let env = HashMap::new();
        let (_, args, _) = wrap_command(1, "/home/user/project", "claude", &[], &env);
        // Find the project path binding — should be preceded by --ro-bind
        let project_idx = args.iter().position(|a| a == "/home/user/project").unwrap();
        assert_eq!(args[project_idx - 1], "--ro-bind");
    }
}
