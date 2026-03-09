use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BugProvider {
    Jira,
    GithubProjects,
    YouTrack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BugItem {
    pub id: String,
    pub key: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    pub labels: Vec<String>,
    pub url: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider: BugProvider,
    pub project_key: String,
    pub base_url: Option<String>,
    pub board_id: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuth {
    pub provider: BugProvider,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>,
}
