use std::sync::Arc;
use tauri::{Emitter, Manager, WindowEvent};
use tokio::sync::RwLock;

pub mod agents;
pub mod arbiter;
pub mod loop_engine;
pub mod bugs;
pub mod bundled;
pub mod commands;
pub mod db;
pub mod error;
pub mod git;
pub mod memory_worker;
pub mod notifications;
pub mod pty;
pub mod sandbox;
pub mod state;
pub mod tray;

use crate::db::init::init_db;
use commands::agent_commands::list_agent_types;
use commands::bugs_commands::{
    check_bug_auth, disconnect_bug_provider, get_bug_detail, get_bug_provider_config, list_bugs,
    save_bug_provider_config, start_bug_oauth,
};
use commands::context_commands::{
    list_context_units, create_context_unit, update_context_unit, delete_context_unit,
    search_context_units, assign_context, unassign_context, list_session_context,
    set_project_default_context, remove_project_default_context, list_project_default_context,
    generate_context_summary,
};
use commands::memory_commands::{
    list_memories, search_memories, toggle_memory_visibility, delete_memory,
    list_consolidations, extract_memories, check_consolidation,
};
use commands::git_commands::{
    git_commit, git_diff, git_diff_file, git_stage, git_status, git_unstage,
};
use commands::notes_commands::{
    create_note, delete_note, list_notes, read_note_content, update_note,
    set_note_context_toggle,
};
use commands::arbiter_commands::{
    get_arbiter_state, set_trust_level, decompose_request,
    list_stories, update_story, delete_story, reorder_stories,
};
use commands::loop_commands::{
    start_loop, pause_loop, resume_loop, cancel_loop,
    get_loop_state, set_quality_gates, get_quality_gates, set_max_iterations,
};
use commands::project_commands::{add_project, arbiter_review, list_cli_models, list_project_files, list_projects, remove_project, update_project};
use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty};
use commands::session_commands::{load_sessions, save_sessions, send_desktop_notification};
use commands::sandbox_commands::get_sandbox_capabilities;
use commands::settings_commands::{get_settings, update_settings, reset_database};
use notifications::notifier::{run_notification_loop, NotificationEvent};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tracing_subscriber::EnvFilter;

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("ove_run_lib=info")),
        )
        .with_target(true)
        .init();

    tracing::info!("ove.run starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create the notification channel
            let (notification_tx, notification_rx) =
                tokio::sync::mpsc::channel::<NotificationEvent>(64);

            // Create the memory worker channel
            let (memory_tx, memory_rx) =
                tokio::sync::mpsc::channel::<memory_worker::MemoryWorkerEvent>(32);

            // Create the loop engine channels
            let (loop_cmd_tx, loop_cmd_rx) =
                tokio::sync::mpsc::channel::<loop_engine::engine::LoopCommand>(16);
            let (loop_event_tx, mut loop_event_rx) =
                tokio::sync::mpsc::channel::<loop_engine::engine::LoopEvent>(64);

            // Initialize SQLite database
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let db = init_db(&app_data_dir)?;

            // Seed bundled content on first run
            {
                let conn = db.lock().unwrap();
                crate::bundled::seed::sync_bundled_content(&conn).ok();
            }

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
            let pty_manager = Arc::new(RwLock::new(pty::manager::PtyManager::new()));
            let app_state = AppState {
                db: db.clone(),
                pty_manager: pty_manager.clone(),
                projects: Arc::new(RwLock::new(loaded_projects)),
                settings: Arc::new(RwLock::new(loaded_settings)),
                notification_tx,
                memory_worker_tx: memory_tx.clone(),
                loop_cmd_tx,
            };

            let app_handle = app.handle().clone();

            // Register AppState as managed state
            app.manage(app_state);

            // Spawn the notification loop
            tauri::async_runtime::spawn(run_notification_loop(app_handle.clone(), notification_rx));

            // Spawn the memory consolidation worker
            tauri::async_runtime::spawn(memory_worker::run_memory_worker(db.clone(), memory_rx));

            // Spawn the loop engine on a dedicated thread; the engine holds
            // MutexGuard across await points which makes the future !Send.
            {
                let db_loop = db.clone();
                let pty_loop = pty_manager.clone();
                let ah_loop = app_handle.clone();
                let mtx_loop = memory_tx.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .expect("loop engine runtime");
                    rt.block_on(loop_engine::engine::run_loop(
                        db_loop,
                        pty_loop,
                        ah_loop,
                        loop_cmd_rx,
                        loop_event_tx,
                        mtx_loop,
                    ));
                });
            }

            // Spawn the loop event forwarder
            let app_handle_loop = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = loop_event_rx.recv().await {
                    let _ = app_handle_loop.emit("loop-event", &event);
                }
            });

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
            list_project_files,
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
            reset_database,
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
            // Context commands
            list_context_units,
            create_context_unit,
            update_context_unit,
            delete_context_unit,
            search_context_units,
            assign_context,
            unassign_context,
            list_session_context,
            set_project_default_context,
            remove_project_default_context,
            list_project_default_context,
            generate_context_summary,
            // Memory commands
            list_memories,
            search_memories,
            toggle_memory_visibility,
            delete_memory,
            list_consolidations,
            extract_memories,
            check_consolidation,
            // Arbiter commands
            get_arbiter_state,
            set_trust_level,
            decompose_request,
            list_stories,
            update_story,
            delete_story,
            reorder_stories,
            // Loop Engine commands
            start_loop,
            pause_loop,
            resume_loop,
            cancel_loop,
            get_loop_state,
            set_quality_gates,
            get_quality_gates,
            set_max_iterations,
            // Sandbox commands
            get_sandbox_capabilities,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
