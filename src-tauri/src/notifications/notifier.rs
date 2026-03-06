use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEvent {
    pub title: String,
    pub body: String,
    pub session_id: Option<String>,
}

/// Show a desktop notification using notify-send on Linux,
/// falling back to the Tauri plugin on other platforms.
fn show_desktop_notification(#[allow(unused_variables)] app_handle: &AppHandle, title: &str, body: &str) {
    #[cfg(target_os = "linux")]
    {
        let title = title.to_string();
        let body = body.to_string();
        std::thread::spawn(move || {
            let _ = std::process::Command::new("notify-send")
                .arg(&title)
                .arg(&body)
                .arg("-u")
                .arg("normal")
                .spawn();
        });
    }

    #[cfg(not(target_os = "linux"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = app_handle
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show();
    }
}

pub async fn run_notification_loop(
    app_handle: AppHandle,
    mut rx: mpsc::Receiver<NotificationEvent>,
) {
    while let Some(event) = rx.recv().await {
        // Emit to frontend
        let _ = app_handle.emit("notification", &event);

        // Show desktop notification
        show_desktop_notification(&app_handle, &event.title, &event.body);
    }
}
