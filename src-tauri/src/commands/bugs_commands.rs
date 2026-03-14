use tokio::net::TcpListener;
use tauri::State;

use crate::bugs::{
    oauth,
    provider::{BugItem, BugProvider, ProviderAuth, ProviderConfig},
};
use crate::db::init::DbPool;
use crate::error::{AppError, lock_err};
use crate::state::AppState;

fn validate_non_empty(value: &str, field: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        Err(AppError::Validation(format!("{} must not be empty", field)))
    } else {
        Ok(())
    }
}

fn load_provider_config_from_db(db: &DbPool, project_id: &str) -> Result<Option<ProviderConfig>, AppError> {
    let conn = db.lock().map_err(lock_err)?;
    match crate::db::bugs::load_bug_config(&conn, project_id)? {
        Some((_provider, config_json)) => {
            let config: ProviderConfig = serde_json::from_str(&config_json)
                .map_err(|e| AppError::Other(format!("Failed to parse provider config: {}", e)))?;
            Ok(Some(config))
        }
        None => Ok(None),
    }
}

fn load_provider_auth_from_db(db: &DbPool, project_id: &str) -> Result<Option<ProviderAuth>, AppError> {
    let conn = db.lock().map_err(lock_err)?;
    match crate::db::bugs::load_bug_auth(&conn, project_id)? {
        Some(auth_json) => {
            // Empty or default '{}' means no auth
            if auth_json.trim().is_empty() || auth_json.trim() == "{}" {
                return Ok(None);
            }
            let auth: ProviderAuth = serde_json::from_str(&auth_json)
                .map_err(|e| AppError::Other(format!("Failed to parse provider auth: {}", e)))?;
            Ok(Some(auth))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn get_bug_provider_config(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Option<ProviderConfig>, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    load_provider_config_from_db(&state.db, &project_id)
}

#[tauri::command]
pub async fn save_bug_provider_config(
    state: State<'_, AppState>,
    project_id: String,
    config: ProviderConfig,
) -> Result<(), AppError> {
    validate_non_empty(&project_id, "project_id")?;
    let provider = serde_json::to_string(&config.provider)
        .map_err(|e| AppError::Other(e.to_string()))?
        .trim_matches('"')
        .to_string();
    let config_json = serde_json::to_string(&config)
        .map_err(|e| AppError::Other(format!("Failed to serialize provider config: {}", e)))?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::bugs::save_bug_config(&conn, &project_id, &provider, &config_json)
        .map_err(Into::into)
}

/// Binds a random localhost port, builds the OAuth authorization URL, then
/// spawns a background task that waits for the redirect callback, exchanges
/// the authorization code for tokens, and persists the auth data.
///
/// The frontend should:
///   1. Call `start_bug_oauth` to get `{ auth_url, port }`.
///   2. Open `auth_url` in the system browser.
///   3. Poll `check_bug_auth` until it returns `true`.
#[tauri::command]
pub async fn start_bug_oauth(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<serde_json::Value, AppError> {
    validate_non_empty(&project_id, "project_id")?;

    let config = load_provider_config_from_db(&state.db, &project_id)?
        .ok_or_else(|| AppError::Other("No provider configured".to_string()))?;

    // Bind on a random port before building the auth URL so we know the port.
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| AppError::Other(format!("Failed to bind OAuth listener: {}", e)))?;
    let port = listener
        .local_addr()
        .map_err(|e| AppError::Io(e))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    let result = oauth::start_oauth(&config, &redirect_uri)
        .await
        .map_err(AppError::Other)?;

    // Clone the db pool for the background task
    let db = state.db.clone();
    let project_id_bg = project_id.clone();
    tokio::spawn(async move {
        match oauth::wait_for_callback(listener).await {
            Ok(code) => match oauth::exchange_token(&config, &code, &redirect_uri).await {
                Ok(auth) => {
                    let auth_json = match serde_json::to_string(&auth) {
                        Ok(j) => j,
                        Err(e) => {
                            eprintln!("[bugs] Failed to serialize provider auth: {}", e);
                            return;
                        }
                    };
                    let conn = match db.lock() {
                        Ok(c) => c,
                        Err(e) => {
                            eprintln!("[bugs] Failed to lock db: {}", e);
                            return;
                        }
                    };
                    if let Err(e) = crate::db::bugs::save_bug_auth(&conn, &project_id_bg, &auth_json) {
                        eprintln!("[bugs] Failed to save provider auth: {}", e);
                    }
                }
                Err(e) => eprintln!("[bugs] Token exchange failed: {}", e),
            },
            Err(e) => eprintln!("[bugs] OAuth callback failed: {}", e),
        }
    });

    Ok(serde_json::json!({
        "auth_url": result.auth_url,
        "port": port,
    }))
}

#[tauri::command]
pub async fn check_bug_auth(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<bool, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    Ok(load_provider_auth_from_db(&state.db, &project_id)?.is_some())
}

#[tauri::command]
pub async fn list_bugs(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<BugItem>, AppError> {
    validate_non_empty(&project_id, "project_id")?;

    let config = load_provider_config_from_db(&state.db, &project_id)?
        .ok_or_else(|| AppError::Other("No provider configured".to_string()))?;
    let auth = load_provider_auth_from_db(&state.db, &project_id)?
        .ok_or_else(|| AppError::Other("Not authenticated".to_string()))?;

    match config.provider {
        BugProvider::Jira => crate::bugs::jira::list_bugs(&auth, &config).await.map_err(AppError::Other),
        BugProvider::GithubProjects => crate::bugs::github::list_bugs(&auth, &config).await.map_err(AppError::Other),
        BugProvider::YouTrack => crate::bugs::youtrack::list_bugs(&auth, &config).await.map_err(AppError::Other),
    }
}

#[tauri::command]
pub async fn get_bug_detail(
    state: State<'_, AppState>,
    project_id: String,
    bug_id: String,
) -> Result<BugItem, AppError> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&bug_id, "bug_id")?;

    let config = load_provider_config_from_db(&state.db, &project_id)?
        .ok_or_else(|| AppError::Other("No provider configured".to_string()))?;
    let auth = load_provider_auth_from_db(&state.db, &project_id)?
        .ok_or_else(|| AppError::Other("Not authenticated".to_string()))?;

    match config.provider {
        BugProvider::Jira => crate::bugs::jira::get_bug_detail(&auth, &config, &bug_id).await.map_err(AppError::Other),
        BugProvider::GithubProjects => {
            crate::bugs::github::get_bug_detail(&auth, &config, &bug_id).await.map_err(AppError::Other)
        }
        BugProvider::YouTrack => {
            crate::bugs::youtrack::get_bug_detail(&auth, &config, &bug_id).await.map_err(AppError::Other)
        }
    }
}

#[tauri::command]
pub async fn disconnect_bug_provider(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), AppError> {
    validate_non_empty(&project_id, "project_id")?;
    let conn = state.db.lock().map_err(lock_err)?;
    crate::db::bugs::delete_bug_data(&conn, &project_id).map_err(Into::into)
}
