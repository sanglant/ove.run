use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use tokio::sync::RwLock;

pub mod agents;
pub mod commands;
pub mod git;
pub mod knowledge;
pub mod notifications;
pub mod pty;
pub mod settings;
pub mod state;
pub mod tray;

use commands::agent_commands::list_agent_types;
use commands::git_commands::{
    git_commit, git_diff, git_diff_file, git_stage, git_status, git_unstage,
};
use commands::knowledge_commands::{
    create_knowledge, delete_knowledge, list_knowledge, read_knowledge_content, update_knowledge,
};
use commands::project_commands::{add_project, guardian_review, list_projects, remove_project, update_project};
use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty};
use commands::settings_commands::{get_settings, update_settings};
use notifications::notifier::{run_notification_loop, NotificationEvent};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create the notification channel
            let (notification_tx, notification_rx) =
                tokio::sync::mpsc::channel::<NotificationEvent>(64);

            // Load persisted data synchronously before building state
            let loaded_projects = commands::project_commands::load_projects_sync();
            let loaded_settings = settings::store::load_settings();

            // Build AppState with pre-loaded data
            let app_state = AppState {
                pty_manager: Arc::new(RwLock::new(pty::manager::PtyManager::new())),
                projects: Arc::new(RwLock::new(loaded_projects)),
                settings: Arc::new(RwLock::new(loaded_settings)),
                notification_tx,
            };

            let app_handle = app.handle().clone();

            // Register AppState as managed state
            app.manage(app_state);

            // Spawn the notification loop
            tauri::async_runtime::spawn(run_notification_loop(app_handle.clone(), notification_rx));

            // Setup system tray
            tray::setup::create_tray(&app_handle)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Check if minimize_to_tray is enabled
                let minimize = {
                    if let Some(state) = window.try_state::<AppState>() {
                        // Use try_read to avoid blocking; fall back to false on contention
                        state
                            .settings
                            .try_read()
                            .map(|s| s.global.minimize_to_tray)
                            .unwrap_or(false)
                    } else {
                        false
                    }
                };

                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // PTY commands
            spawn_pty,
            write_pty,
            resize_pty,
            kill_pty,
            // Git commands
            git_status,
            git_diff,
            git_diff_file,
            git_stage,
            git_unstage,
            git_commit,
            // Project commands
            list_projects,
            add_project,
            remove_project,
            update_project,
            guardian_review,
            // Knowledge commands
            list_knowledge,
            create_knowledge,
            read_knowledge_content,
            update_knowledge,
            delete_knowledge,
            // Settings commands
            get_settings,
            update_settings,
            // Agent commands
            list_agent_types,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
