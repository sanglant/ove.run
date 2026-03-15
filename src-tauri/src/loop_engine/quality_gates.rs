use serde::Serialize;
use crate::state::QualityGateConfig;

#[derive(Debug, Clone, Serialize)]
pub struct GateResult {
    pub name: String,
    pub passed: bool,
    pub output: String,
}

pub async fn run_quality_gates(config: &QualityGateConfig, project_path: &str) -> Vec<GateResult> {
    let mut results = Vec::new();
    if let Some(cmd) = &config.build_command {
        results.push(run_gate("build", cmd, project_path).await);
    }
    if let Some(cmd) = &config.lint_command {
        results.push(run_gate("lint", cmd, project_path).await);
    }
    if let Some(cmd) = &config.typecheck_command {
        results.push(run_gate("typecheck", cmd, project_path).await);
    }
    if let Some(cmd) = &config.test_command {
        results.push(run_gate("test", cmd, project_path).await);
    }
    results
}

async fn run_gate(name: &str, command: &str, cwd: &str) -> GateResult {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return GateResult { name: name.to_string(), passed: false, output: "Empty command".to_string() };
    }
    let program = parts[0];
    let args = &parts[1..];

    match tokio::process::Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let combined = format!("{}{}", stdout, stderr);
            // Limit output size
            let truncated = if combined.len() > 5000 { combined[..5000].to_string() } else { combined.to_string() };
            GateResult {
                name: name.to_string(),
                passed: output.status.success(),
                output: truncated,
            }
        }
        Err(e) => GateResult {
            name: name.to_string(),
            passed: false,
            output: format!("Failed to run: {}", e),
        },
    }
}

pub fn all_gates_passed(results: &[GateResult]) -> bool {
    results.iter().all(|r| r.passed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gate(name: &str, passed: bool) -> GateResult {
        GateResult {
            name: name.to_string(),
            passed,
            output: String::new(),
        }
    }

    #[test]
    fn all_gates_passed_empty() {
        // Empty gates = vacuously true (no gates configured)
        assert!(all_gates_passed(&[]));
    }

    #[test]
    fn all_gates_passed_all_pass() {
        let results = vec![gate("build", true), gate("test", true), gate("lint", true)];
        assert!(all_gates_passed(&results));
    }

    #[test]
    fn all_gates_passed_one_fails() {
        let results = vec![gate("build", true), gate("test", false), gate("lint", true)];
        assert!(!all_gates_passed(&results));
    }

    #[test]
    fn all_gates_passed_all_fail() {
        let results = vec![gate("build", false), gate("test", false)];
        assert!(!all_gates_passed(&results));
    }

    #[test]
    fn all_gates_passed_single_pass() {
        assert!(all_gates_passed(&[gate("build", true)]));
    }

    #[test]
    fn all_gates_passed_single_fail() {
        assert!(!all_gates_passed(&[gate("build", false)]));
    }

    #[tokio::test]
    async fn run_gate_empty_command() {
        let result = run_gate("test", "", "/tmp").await;
        assert!(!result.passed);
        assert_eq!(result.output, "Empty command");
    }

    #[tokio::test]
    async fn run_gate_successful_command() {
        let result = run_gate("echo", "echo hello", "/tmp").await;
        assert!(result.passed);
        assert!(result.output.contains("hello"));
    }

    #[tokio::test]
    async fn run_gate_failing_command() {
        let result = run_gate("test", "false", "/tmp").await;
        assert!(!result.passed);
    }

    #[tokio::test]
    async fn run_gate_nonexistent_command() {
        let result = run_gate("test", "nonexistent_command_xyz_12345", "/tmp").await;
        assert!(!result.passed);
        assert!(result.output.contains("Failed to run"));
    }

    #[tokio::test]
    async fn run_quality_gates_no_commands_configured() {
        let config = QualityGateConfig::default();
        let results = run_quality_gates(&config, "/tmp").await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn run_quality_gates_with_build_command() {
        let config = QualityGateConfig {
            build_command: Some("echo build-ok".to_string()),
            lint_command: None,
            typecheck_command: None,
            test_command: None,
            arbiter_judge: false,
        };
        let results = run_quality_gates(&config, "/tmp").await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "build");
        assert!(results[0].passed);
    }

    #[tokio::test]
    async fn run_quality_gates_multiple_commands() {
        let config = QualityGateConfig {
            build_command: Some("echo build".to_string()),
            lint_command: Some("echo lint".to_string()),
            typecheck_command: Some("echo typecheck".to_string()),
            test_command: Some("echo test".to_string()),
            arbiter_judge: false,
        };
        let results = run_quality_gates(&config, "/tmp").await;
        assert_eq!(results.len(), 4);
        assert_eq!(results[0].name, "build");
        assert_eq!(results[1].name, "lint");
        assert_eq!(results[2].name, "typecheck");
        assert_eq!(results[3].name, "test");
        assert!(results.iter().all(|r| r.passed));
    }

    #[tokio::test]
    async fn run_quality_gates_mixed_results() {
        let config = QualityGateConfig {
            build_command: Some("echo ok".to_string()),
            lint_command: None,
            typecheck_command: None,
            test_command: Some("false".to_string()),
            arbiter_judge: false,
        };
        let results = run_quality_gates(&config, "/tmp").await;
        assert_eq!(results.len(), 2);
        assert!(results[0].passed);  // build
        assert!(!results[1].passed); // test
        assert!(!all_gates_passed(&results));
    }
}
