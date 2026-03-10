use serde::{Deserialize, Serialize};
use crate::agents::registry::get_agent_definitions;
use crate::state::AgentType;

/// Serializable DTO for agent definitions (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinitionDto {
    pub agent_type: AgentType,
    pub display_name: String,
    pub command: String,
    pub default_args: Vec<String>,
    pub yolo_flag: String,
    pub resume_args: Vec<String>,
    pub detect_idle_pattern: String,
    pub detect_input_pattern: String,
    pub detect_finished_pattern: String,
    pub icon: String,
}

#[tauri::command]
pub async fn list_agent_types() -> Result<Vec<AgentDefinitionDto>, String> {
    let defs = get_agent_definitions();
    let dtos = defs
        .into_iter()
        .map(|d| AgentDefinitionDto {
            agent_type: d.agent_type,
            display_name: d.display_name,
            command: d.command,
            default_args: d.default_args,
            yolo_flag: d.yolo_flag,
            resume_args: d.resume_args,
            detect_idle_pattern: d.detect_idle_pattern,
            detect_input_pattern: d.detect_input_pattern,
            detect_finished_pattern: d.detect_finished_pattern,
            icon: d.icon,
        })
        .collect();

    Ok(dtos)
}
