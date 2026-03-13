use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};

use crate::db::init::DbPool;

pub struct AppState {
    pub db: DbPool,
    pub pty_manager: Arc<RwLock<crate::pty::manager::PtyManager>>,
    pub projects: Arc<RwLock<Vec<Project>>>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub notification_tx: tokio::sync::mpsc::Sender<crate::notifications::notifier::NotificationEvent>,
    pub memory_worker_tx: tokio::sync::mpsc::Sender<crate::memory_worker::MemoryWorkerEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub git_enabled: bool,
    #[serde(default)]
    pub arbiter_enabled: bool,
    #[serde(default)]
    pub arbiter_agent_type: Option<String>,
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
    #[serde(default = "default_arbiter_timeout")]
    pub arbiter_timeout_seconds: u32,
    #[serde(default)]
    pub arbiter_provider: String,
    #[serde(default)]
    pub arbiter_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    pub default_yolo_mode: bool,
    pub custom_args: Vec<String>,
    pub env_vars: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextUnit {
    pub id: String,
    pub project_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub unit_type: String,
    pub scope: String,
    pub tags_json: String,
    pub l0_summary: Option<String>,
    pub l1_overview: Option<String>,
    pub l2_content: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: String,
    pub project_id: String,
    pub session_id: Option<String>,
    pub visibility: String,
    pub content: String,
    pub summary: Option<String>,
    pub entities_json: String,
    pub topics_json: String,
    pub importance: f64,
    pub consolidated: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consolidation {
    pub id: String,
    pub project_id: String,
    pub source_ids_json: String,
    pub summary: String,
    pub insight: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[repr(u8)]
pub enum TrustLevel {
    Supervised = 1,
    Autonomous = 2,
    FullAuto = 3,
}

impl TrustLevel {
    pub fn from_i32(v: i32) -> Self {
        match v {
            1 => TrustLevel::Supervised,
            3 => TrustLevel::FullAuto,
            _ => TrustLevel::Autonomous,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbiterStateRow {
    pub project_id: String,
    pub trust_level: TrustLevel,
    pub loop_status: String,
    pub current_story_id: Option<String>,
    pub iteration_count: i32,
    pub max_iterations: i32,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: Option<String>,
    pub priority: i32,
    pub status: String,
    pub depends_on_json: String,
    pub iteration_attempts: i32,
    pub created_at: String,
}

fn default_arbiter_timeout() -> u32 {
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
                arbiter_timeout_seconds: 20,
                arbiter_provider: String::new(),
                arbiter_model: String::new(),
            },
            agents: HashMap::new(),
        }
    }
}
