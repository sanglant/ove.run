use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::policy;

/// Check if sandbox-exec (Seatbelt) is available.
pub fn is_available() -> bool {
    Path::new("/usr/bin/sandbox-exec").exists()
        || Command::new("sandbox-exec")
            .arg("-n")
            .arg("no-internet")
            .arg("true")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
}

/// Generate a Seatbelt (SBPL) policy profile based on trust level.
fn build_seatbelt_profile(trust_level: u32, project_path: &str) -> String {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/Users/user"));
    let home_str = home.to_string_lossy();

    // Build blocked paths (deny before allow)
    let mut deny_rules = String::new();
    for blocked in policy::BLOCKED_PATHS {
        let full = format!("{}/{}", home_str, blocked);
        deny_rules.push_str(&format!(
            "  (deny file-read* file-write* (subpath \"{}\"))\n",
            full
        ));
    }

    // Build agent config read-only rules
    let mut config_rules = String::new();
    for config in policy::AGENT_CONFIG_PATHS {
        let full = format!("{}/{}", home_str, config);
        if Path::new(&full).exists() {
            config_rules.push_str(&format!("  (allow file-read* (subpath \"{}\"))\n", full));
        }
    }

    // Build runtime read-only rules
    let mut runtime_rules = String::new();
    for rt in policy::RUNTIME_PATHS {
        let full = format!("{}/{}", home_str, rt);
        if Path::new(&full).exists() {
            runtime_rules.push_str(&format!("  (allow file-read* (subpath \"{}\"))\n", full));
        }
    }

    // Project access based on trust level
    let project_rule = if trust_level <= 1 {
        format!("  (allow file-read* (subpath \"{}\"))\n", project_path)
    } else {
        format!(
            "  (allow file-read* file-write* (subpath \"{}\"))\n",
            project_path
        )
    };

    format!(
        r#"(version 1)
(deny default)

; Process execution
(allow process-exec)
(allow process-fork)
(allow signal)
(allow sysctl-read)
(allow mach-lookup)

; System paths (read-only)
(allow file-read* (subpath "/usr"))
(allow file-read* (subpath "/Library"))
(allow file-read* (subpath "/System"))
(allow file-read* (subpath "/bin"))
(allow file-read* (subpath "/sbin"))
(allow file-read* (subpath "/private/etc"))
(allow file-read* (subpath "/private/var/db"))
(allow file-read* (subpath "/dev"))
(allow file-read* (subpath "/Applications"))

; Temp directories (read-write)
(allow file-read* file-write* (subpath "/private/tmp"))
(allow file-read* file-write* (subpath "/tmp"))
(allow file-read* file-write* (subpath "/private/var/folders"))

; Blocked sensitive paths
{}
; Agent config dirs (read-only for auth)
{}
; Dev tool runtimes (read-only)
{}
; Project access
{}
; Network — allow all (proxy-based filtering is Phase 2)
(allow network*)

; IPC
(allow ipc-posix-shm)
"#,
        deny_rules, config_rules, runtime_rules, project_rule
    )
}

/// Wrap a command with sandbox-exec.
pub fn wrap_command(
    trust_level: u32,
    project_path: &str,
    command: &str,
    args: &[String],
    env: &HashMap<String, String>,
) -> (String, Vec<String>, HashMap<String, String>) {
    let profile = build_seatbelt_profile(trust_level, project_path);

    let mut sandbox_args = vec![
        "-p".to_string(),
        profile,
        "--".to_string(),
        command.to_string(),
    ];
    sandbox_args.extend(args.iter().cloned());

    // Scrub dangerous env vars
    let mut sandbox_env = env.clone();
    for var in &[
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "GCP_SERVICE_ACCOUNT_KEY",
    ] {
        sandbox_env.remove(*var);
    }

    ("sandbox-exec".to_string(), sandbox_args, sandbox_env)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_contains_deny_ssh() {
        let profile = build_seatbelt_profile(2, "/Users/test/project");
        assert!(profile.contains(".ssh"));
        assert!(profile.contains("deny"));
    }

    #[test]
    fn wrap_produces_sandbox_exec_command() {
        let env = HashMap::new();
        let (cmd, args, _) = wrap_command(2, "/Users/test/project", "claude", &[], &env);
        assert_eq!(cmd, "sandbox-exec");
        assert_eq!(args[0], "-p");
        assert!(args.contains(&"--".to_string()));
        assert!(args.contains(&"claude".to_string()));
    }
}
