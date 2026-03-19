use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{oneshot, Mutex};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionResponse {
    pub response: String,
    pub option_index: Option<usize>,
    pub auto_resolved: bool,
}

/// Internal representation — not serialized over the wire.
pub struct PendingQuestion {
    pub id: String,
    pub session_id: String,
    pub project_id: String,
    pub question: String,
    pub options: Vec<String>,
    pub allow_free_input: bool,
    pub response_tx: oneshot::Sender<QuestionResponse>,
    pub created_at: Instant,
}

/// Serializable version for listing pending questions in the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingQuestionInfo {
    pub id: String,
    pub session_id: String,
    pub project_id: String,
    pub question: String,
    pub options: Vec<String>,
    pub allow_free_input: bool,
    pub created_at_ms: u64,
}

#[derive(Clone)]
pub struct QuestionManager {
    pending: Arc<Mutex<HashMap<String, PendingQuestion>>>,
}

impl QuestionManager {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Stores a pending question and returns a receiver that will deliver the response.
    pub async fn submit_question(
        &self,
        id: String,
        session_id: String,
        project_id: String,
        question: String,
        options: Vec<String>,
        allow_free_input: bool,
    ) -> oneshot::Receiver<QuestionResponse> {
        let (tx, rx) = oneshot::channel();
        let pending = PendingQuestion {
            id: id.clone(),
            session_id,
            project_id,
            question,
            options,
            allow_free_input,
            response_tx: tx,
            created_at: Instant::now(),
        };
        self.pending.lock().await.insert(id, pending);
        rx
    }

    /// Sends a response to a pending question and removes it from the map.
    pub async fn answer_question(
        &self,
        question_id: &str,
        response: QuestionResponse,
    ) -> Result<(), String> {
        let mut map = self.pending.lock().await;
        let pq = map
            .remove(question_id)
            .ok_or_else(|| format!("question not found: {question_id}"))?;
        // Receiver may have been dropped; that's not an error we need to surface.
        let _ = pq.response_tx.send(response);
        Ok(())
    }

    /// Returns serializable info for all pending questions with elapsed time.
    pub async fn list_pending(&self) -> Vec<PendingQuestionInfo> {
        let map = self.pending.lock().await;
        map.values()
            .map(|pq| PendingQuestionInfo {
                id: pq.id.clone(),
                session_id: pq.session_id.clone(),
                project_id: pq.project_id.clone(),
                question: pq.question.clone(),
                options: pq.options.clone(),
                allow_free_input: pq.allow_free_input,
                created_at_ms: pq.created_at.elapsed().as_millis() as u64,
            })
            .collect()
    }

    /// Cancels a pending question by sending a default "use your best judgment" response.
    pub async fn cancel_question(&self, question_id: &str) -> Result<(), String> {
        self.answer_question(
            question_id,
            QuestionResponse {
                response: "Use your best judgment".to_string(),
                option_index: None,
                auto_resolved: true,
            },
        )
        .await
    }
}
