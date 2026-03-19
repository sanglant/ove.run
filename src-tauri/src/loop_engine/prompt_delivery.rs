use crate::state::{AgentDefinition, PromptDelivery};

/// Deliver a prompt to a running agent session via PTY write (InteractiveInput only)
pub fn deliver_interactive_prompt(prompt: &str) -> Vec<u8> {
    format!("{}\r", prompt).into_bytes()
}

/// Build spawn arguments including prompt if delivery is via CLI flag or positional arg
pub fn build_spawn_args(agent_def: &AgentDefinition, prompt: &str, yolo_mode: bool) -> Vec<String> {
    let mut args = agent_def.default_args.clone();
    if yolo_mode && !agent_def.yolo_flag.is_empty() {
        args.push(agent_def.yolo_flag.clone());
    }
    match &agent_def.prompt_delivery {
        Some(PromptDelivery::CliFlag(flag)) => {
            args.push(flag.clone());
            args.push(prompt.to_string());
        }
        Some(PromptDelivery::PositionalArg) => {
            args.push(prompt.to_string());
        }
        _ => {}
    }
    args
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AgentType;

    fn make_agent(
        delivery: Option<PromptDelivery>,
        default_args: Vec<&str>,
        yolo_flag: &str,
    ) -> AgentDefinition {
        AgentDefinition {
            agent_type: AgentType::Claude,
            display_name: "Test".to_string(),
            command: "test-agent".to_string(),
            default_args: default_args.into_iter().map(|s| s.to_string()).collect(),
            yolo_flag: yolo_flag.to_string(),
            resume_args: vec![],
            detect_idle_pattern: String::new(),
            detect_input_pattern: String::new(),
            detect_finished_pattern: String::new(),
            icon: "test".to_string(),
            prompt_delivery: delivery,
        }
    }

    #[test]
    fn deliver_interactive_prompt_appends_cr() {
        let bytes = deliver_interactive_prompt("hello world");
        assert_eq!(bytes, b"hello world\r");
    }

    #[test]
    fn deliver_interactive_prompt_empty() {
        let bytes = deliver_interactive_prompt("");
        assert_eq!(bytes, b"\r");
    }

    #[test]
    fn build_spawn_args_cli_flag() {
        let agent = make_agent(Some(PromptDelivery::CliFlag("-p".to_string())), vec![], "");
        let args = build_spawn_args(&agent, "do the thing", false);
        assert_eq!(args, vec!["-p", "do the thing"]);
    }

    #[test]
    fn build_spawn_args_positional() {
        let agent = make_agent(Some(PromptDelivery::PositionalArg), vec![], "");
        let args = build_spawn_args(&agent, "do the thing", false);
        assert_eq!(args, vec!["do the thing"]);
    }

    #[test]
    fn build_spawn_args_interactive_excludes_prompt() {
        let agent = make_agent(Some(PromptDelivery::InteractiveInput), vec![], "");
        let args = build_spawn_args(&agent, "do the thing", false);
        assert!(
            args.is_empty(),
            "InteractiveInput should not add prompt to args"
        );
    }

    #[test]
    fn build_spawn_args_none_delivery_excludes_prompt() {
        let agent = make_agent(None, vec![], "");
        let args = build_spawn_args(&agent, "do the thing", false);
        assert!(args.is_empty());
    }

    #[test]
    fn build_spawn_args_with_default_args() {
        let agent = make_agent(
            Some(PromptDelivery::CliFlag("-p".to_string())),
            vec!["--verbose", "--no-color"],
            "",
        );
        let args = build_spawn_args(&agent, "prompt", false);
        assert_eq!(args, vec!["--verbose", "--no-color", "-p", "prompt"]);
    }

    #[test]
    fn build_spawn_args_yolo_mode_adds_flag() {
        let agent = make_agent(
            Some(PromptDelivery::CliFlag("-p".to_string())),
            vec![],
            "--dangerously-skip-permissions",
        );
        let args = build_spawn_args(&agent, "prompt", true);
        assert_eq!(args, vec!["--dangerously-skip-permissions", "-p", "prompt"]);
    }

    #[test]
    fn build_spawn_args_yolo_mode_false_skips_flag() {
        let agent = make_agent(
            Some(PromptDelivery::CliFlag("-p".to_string())),
            vec![],
            "--dangerously-skip-permissions",
        );
        let args = build_spawn_args(&agent, "prompt", false);
        assert_eq!(args, vec!["-p", "prompt"]);
    }

    #[test]
    fn build_spawn_args_yolo_mode_empty_flag_skips() {
        let agent = make_agent(Some(PromptDelivery::CliFlag("-p".to_string())), vec![], "");
        let args = build_spawn_args(&agent, "prompt", true);
        // yolo_mode is true but flag is empty — should not add empty string
        assert_eq!(args, vec!["-p", "prompt"]);
    }
}
