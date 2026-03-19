use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpActivity {
    pub id: String,
    pub timestamp: String,
    pub session_id: String,
    pub tool_name: String,
    pub status: Option<String>,
    pub task_summary: Option<String>,
    pub question: Option<String>,
    pub gate_passed: Option<bool>,
}

const MAX_ENTRIES: usize = 200;

#[derive(Clone)]
pub struct ActivityStore {
    entries: Arc<Mutex<VecDeque<McpActivity>>>,
}

impl ActivityStore {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    /// Records a new activity entry, evicting the oldest if capacity is exceeded.
    pub async fn record(&self, activity: McpActivity) {
        let mut entries = self.entries.lock().await;
        entries.push_back(activity);
        if entries.len() > MAX_ENTRIES {
            entries.pop_front();
        }
    }

    /// Returns all entries, optionally filtered by session_id.
    pub async fn list(&self, session_id: Option<&str>) -> Vec<McpActivity> {
        let entries = self.entries.lock().await;
        match session_id {
            Some(sid) => entries
                .iter()
                .filter(|a| a.session_id == sid)
                .cloned()
                .collect(),
            None => entries.iter().cloned().collect(),
        }
    }

    /// Clears all recorded activity.
    pub async fn clear(&self) {
        self.entries.lock().await.clear();
    }
}
