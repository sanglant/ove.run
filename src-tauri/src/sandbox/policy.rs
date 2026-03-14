/// Paths that should NEVER be accessible to agents, regardless of trust level.
pub const BLOCKED_PATHS: &[&str] = &[
    ".ssh",
    ".gnupg",
    ".aws",
    ".config/gcloud",
    ".azure",
    ".kube",
    ".docker",
    ".password-store",
];

/// Sensitive file patterns agents should not read.
pub const SENSITIVE_PATTERNS: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    "credentials.json",
    "service-account.json",
];

/// Agent config directories that must remain accessible (read-only) for auth.
pub const AGENT_CONFIG_PATHS: &[&str] = &[
    ".claude",
    ".config/claude",
    ".config/gemini",
    ".config/gh",
    ".config/codex",
    ".openai",
    ".npmrc",
    ".gitconfig",
    ".config/git",
];

/// System paths needed for agents to function (read-only).
pub const SYSTEM_READ_PATHS: &[&str] = &[
    "/usr",
    "/lib",
    "/lib64",
    "/bin",
    "/sbin",
    "/etc/resolv.conf",
    "/etc/ssl",
    "/etc/ca-certificates",
    "/etc/passwd",
    "/etc/group",
    "/etc/hosts",
    "/etc/localtime",
    "/etc/alternatives",
];

/// Paths for common dev tool runtimes (read-only).
pub const RUNTIME_PATHS: &[&str] = &[
    ".nvm",
    ".local/share/fnm",
    ".cargo",
    ".rustup",
    ".local/bin",
    ".local/lib",
    ".pyenv",
    ".rbenv",
    ".goenv",
    ".bun",
    ".deno",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked_paths_includes_ssh() {
        assert!(BLOCKED_PATHS.contains(&".ssh"));
    }

    #[test]
    fn blocked_paths_includes_aws() {
        assert!(BLOCKED_PATHS.contains(&".aws"));
    }

    #[test]
    fn sensitive_patterns_includes_env() {
        assert!(SENSITIVE_PATTERNS.contains(&".env"));
        assert!(SENSITIVE_PATTERNS.contains(&".env.production"));
    }

    #[test]
    fn agent_configs_include_all_supported_agents() {
        assert!(AGENT_CONFIG_PATHS.contains(&".claude"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/gemini"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/gh"));
        assert!(AGENT_CONFIG_PATHS.contains(&".config/codex"));
    }

    #[test]
    fn runtime_paths_include_major_runtimes() {
        assert!(RUNTIME_PATHS.contains(&".nvm"));
        assert!(RUNTIME_PATHS.contains(&".cargo"));
        assert!(RUNTIME_PATHS.contains(&".pyenv"));
    }

    #[test]
    fn blocked_paths_do_not_overlap_with_agent_configs() {
        for blocked in BLOCKED_PATHS {
            assert!(
                !AGENT_CONFIG_PATHS.contains(blocked),
                "Blocked path '{}' should not be in agent configs",
                blocked
            );
        }
    }

    #[test]
    fn system_paths_include_ssl_certs() {
        assert!(SYSTEM_READ_PATHS.contains(&"/etc/ssl"));
        assert!(SYSTEM_READ_PATHS.contains(&"/etc/ca-certificates"));
    }
}
