use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};

pub struct AppState {
    pub pty_manager: Arc<RwLock<crate::pty::manager::PtyManager>>,
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub notification_tx: tokio::sync::mpsc::Sender<crate::notifications::notifier::NotificationEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub git_enabled: bool,
    #[serde(default)]
    pub guardian_enabled: bool,
    #[serde(default)]
    pub guardian_agent_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    Claude,
    Gemini,
    Copilot,
    Codex,
    Terminal,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Starting,
    Idle,
    Working,
    NeedsInput,
    Finished,
    Error,
}

#[derive(Debug, Clone)]
pub struct AgentDefinition {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub file_path: String,
    pub content_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub global: GlobalSettings,
    pub agents: HashMap<String, AgentSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub notifications_enabled: bool,
    pub minimize_to_tray: bool,
    pub terminal_scrollback: u32,
    #[serde(default = "default_guardian_timeout")]
    pub guardian_timeout_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    pub default_yolo_mode: bool,
    pub custom_args: Vec<String>,
    pub env_vars: HashMap<String, String>,
}

fn default_guardian_timeout() -> u32 {
    20
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            global: GlobalSettings {
                theme: "dark".to_string(),
                font_family: "JetBrains Mono, monospace".to_string(),
                font_size: 14,
                notifications_enabled: true,
                minimize_to_tray: false,
                terminal_scrollback: 10000,
                guardian_timeout_seconds: 20,
            },
            agents: HashMap::new(),
        }
    }
}
