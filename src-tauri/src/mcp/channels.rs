use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{watch, Mutex};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionSignal {
    pub session_id: String,
    pub story_id: Option<String>,
    pub gates_passed: bool,
    pub judgment_passed: Option<bool>,
    pub reasoning: Option<String>,
}

#[derive(Clone)]
pub struct McpChannels {
    completion_txs: Arc<Mutex<HashMap<String, watch::Sender<Option<CompletionSignal>>>>>,
}

impl McpChannels {
    pub fn new() -> Self {
        Self {
            completion_txs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Registers a session for completion signaling. Returns a receiver that will
    /// receive the completion signal when it arrives.
    pub async fn register(&self, session_id: &str) -> watch::Receiver<Option<CompletionSignal>> {
        let (tx, rx) = watch::channel(None);
        self.completion_txs
            .lock()
            .await
            .insert(session_id.to_string(), tx);
        rx
    }

    /// Sends a completion signal for the given session. No-op if the session is not registered.
    pub async fn signal(&self, session_id: &str, signal: CompletionSignal) {
        let map = self.completion_txs.lock().await;
        if let Some(tx) = map.get(session_id) {
            let _ = tx.send(Some(signal));
        }
    }

    /// Removes the sender for the given session.
    pub async fn unregister(&self, session_id: &str) {
        self.completion_txs.lock().await.remove(session_id);
    }
}
