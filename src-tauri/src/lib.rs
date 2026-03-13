use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use tokio::sync::RwLock;

pub mod agents;
pub mod bugs;
pub mod commands;
pub mod db;
pub mod git;
pub mod notifications;
pub mod pty;
pub mod state;
pub mod tray;

use crate::db::init::init_db;
use commands::agent_commands::list_agent_types;
use commands::bugs_commands::{
    check_bug_auth, disconnect_bug_provider, get_bug_detail, get_bug_provider_config, list_bugs,
    save_bug_provider_config, start_bug_oauth,
};
use commands::git_commands::{
    git_commit, git_diff, git_diff_file, git_stage, git_status, git_unstage,
};
use commands::notes_commands::{
    create_note, delete_note, list_notes, read_note_content, update_note,
    set_note_context_toggle,
};
use commands::project_commands::{add_project, arbiter_review, list_cli_models, list_projects, remove_project, update_project};
use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty};
use commands::session_commands::{load_sessions, save_sessions, send_desktop_notification};
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

            // Initialize SQLite database
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let db = init_db(&app_data_dir)?;

            // Load persisted data from SQLite
            let loaded_projects = {
                let conn = db.lock().unwrap();
                crate::db::projects::load_projects_sync(&conn)
            };
            let loaded_settings = {
                let conn = db.lock().unwrap();
                crate::db::settings::load_app_settings(&conn)
            };

            // Build AppState with pre-loaded data
            let app_state = AppState {
                db: db.clone(),
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
            arbiter_review,
            list_cli_models,
            // Notes commands
            list_notes,
            create_note,
            read_note_content,
            update_note,
            delete_note,
            set_note_context_toggle,
            // Settings commands
            get_settings,
            update_settings,
            // Agent commands
            list_agent_types,
            // Session commands
            save_sessions,
            load_sessions,
            send_desktop_notification,
            // Bug commands
            get_bug_provider_config,
            save_bug_provider_config,
            start_bug_oauth,
            check_bug_auth,
            list_bugs,
            get_bug_detail,
            disconnect_bug_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
