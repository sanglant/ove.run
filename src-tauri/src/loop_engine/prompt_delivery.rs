use crate::state::{PromptDelivery, AgentDefinition};

/// Deliver a prompt to a running agent session via PTY write (InteractiveInput only)
pub fn deliver_interactive_prompt(prompt: &str) -> Vec<u8> {
    format!("{}\r", prompt).into_bytes()
}

/// Build spawn arguments including prompt if delivery is via CLI flag or positional arg
pub fn build_spawn_args(
    agent_def: &AgentDefinition,
    prompt: &str,
    yolo_mode: bool,
) -> Vec<String> {
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
