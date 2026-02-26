use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEvent {
    pub title: String,
    pub body: String,
    pub session_id: Option<String>,
}

pub async fn run_notification_loop(
    app_handle: AppHandle,
    mut rx: mpsc::Receiver<NotificationEvent>,
) {
    while let Some(event) = rx.recv().await {
        // Emit to frontend
        let _ = app_handle.emit("notification", &event);

        // Show desktop notification
        let _ = app_handle
            .notification()
            .builder()
            .title(&event.title)
            .body(&event.body)
            .show();
    }
}
