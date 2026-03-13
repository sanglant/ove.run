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
