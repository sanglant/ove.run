use crate::state::{AgentDefinition, AgentType};

pub fn get_agent_definitions() -> Vec<AgentDefinition> {
    vec![
        AgentDefinition {
            agent_type: AgentType::Claude,
            display_name: "Claude Code".to_string(),
            command: "claude".to_string(),
            default_args: vec![],
            yolo_flag: "--dangerously-skip-permissions".to_string(),
            // Claude shows a prompt character or specific idle indicators
            detect_idle_pattern: r"(?i)(>\s*$|\$\s*$|claude>\s*$)".to_string(),
            // Claude asks for human input / confirmation
            detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\])".to_string(),
            // Claude signals task completion
            detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed)".to_string(),
            icon: "claude".to_string(),
        },
        AgentDefinition {
            agent_type: AgentType::Gemini,
            display_name: "Gemini CLI".to_string(),
            command: "gemini".to_string(),
            default_args: vec![],
            yolo_flag: "--yolo".to_string(),
            // Gemini shows a prompt when idle
            detect_idle_pattern: r"(?i)(gemini>\s*$|>\s*$|\$\s*$)".to_string(),
            // Gemini asks for confirmation or input
            detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\]|enter your)".to_string(),
            // Gemini signals task completion
            detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed|done\.)".to_string(),
            icon: "gemini".to_string(),
        },
        AgentDefinition {
            agent_type: AgentType::Copilot,
            display_name: "GitHub Copilot".to_string(),
            command: "copilot".to_string(),
            default_args: vec![],
            yolo_flag: "--yolo".to_string(),
            detect_idle_pattern: r"(?i)(copilot>\s*$|>\s*$|\$\s*$)".to_string(),
            detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\]|approve|deny|allow)".to_string(),
            detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed|done\.)".to_string(),
            icon: "copilot".to_string(),
        },
        AgentDefinition {
            agent_type: AgentType::Codex,
            display_name: "Codex CLI".to_string(),
            command: "codex".to_string(),
            default_args: vec![],
            yolo_flag: "--full-auto".to_string(),
            detect_idle_pattern: r"(?i)(codex>\s*$|>\s*$|\$\s*$)".to_string(),
            detect_input_pattern: r"(?i)(do you want to|shall i|would you like|please confirm|y/n|yes/no|\[y\]|\[n\]|approve|deny|apply changes)".to_string(),
            detect_finished_pattern: r"(?i)(task completed|all done|finished|i've completed|i have completed|done\.)".to_string(),
            icon: "codex".to_string(),
        },
    ]
}
