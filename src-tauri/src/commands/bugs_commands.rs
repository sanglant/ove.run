use tokio::net::TcpListener;

use crate::bugs::{
    oauth,
    provider::{BugItem, BugProvider, ProviderConfig},
    store,
};

fn validate_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} must not be empty", field))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn get_bug_provider_config(project_id: String) -> Result<Option<ProviderConfig>, String> {
    validate_non_empty(&project_id, "project_id")?;
    store::load_provider_config(&project_id)
}

#[tauri::command]
pub async fn save_bug_provider_config(
    project_id: String,
    config: ProviderConfig,
) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    store::save_provider_config(&project_id, &config)
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
pub async fn start_bug_oauth(project_id: String) -> Result<serde_json::Value, String> {
    validate_non_empty(&project_id, "project_id")?;

    let config = store::load_provider_config(&project_id)?.ok_or("No provider configured")?;

    // Bind on a random port before building the auth URL so we know the port.
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind OAuth listener: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    let result = oauth::start_oauth(&config, &redirect_uri).await?;

    // Spawn a background task that owns the listener and completes the flow.
    let project_id_bg = project_id.clone();
    tokio::spawn(async move {
        match oauth::wait_for_callback(listener).await {
            Ok(code) => match oauth::exchange_token(&config, &code, &redirect_uri).await {
                Ok(auth) => {
                    if let Err(e) = store::save_provider_auth(&project_id_bg, &auth) {
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
pub async fn check_bug_auth(project_id: String) -> Result<bool, String> {
    validate_non_empty(&project_id, "project_id")?;
    Ok(store::load_provider_auth(&project_id)?.is_some())
}

#[tauri::command]
pub async fn list_bugs(project_id: String) -> Result<Vec<BugItem>, String> {
    validate_non_empty(&project_id, "project_id")?;

    let config =
        store::load_provider_config(&project_id)?.ok_or("No provider configured")?;
    let auth = store::load_provider_auth(&project_id)?.ok_or("Not authenticated")?;

    match config.provider {
        BugProvider::Jira => crate::bugs::jira::list_bugs(&auth, &config).await,
        BugProvider::GithubProjects => crate::bugs::github::list_bugs(&auth, &config).await,
        BugProvider::YouTrack => crate::bugs::youtrack::list_bugs(&auth, &config).await,
    }
}

#[tauri::command]
pub async fn get_bug_detail(project_id: String, bug_id: String) -> Result<BugItem, String> {
    validate_non_empty(&project_id, "project_id")?;
    validate_non_empty(&bug_id, "bug_id")?;

    let config =
        store::load_provider_config(&project_id)?.ok_or("No provider configured")?;
    let auth = store::load_provider_auth(&project_id)?.ok_or("Not authenticated")?;

    match config.provider {
        BugProvider::Jira => crate::bugs::jira::get_bug_detail(&auth, &config, &bug_id).await,
        BugProvider::GithubProjects => {
            crate::bugs::github::get_bug_detail(&auth, &config, &bug_id).await
        }
        BugProvider::YouTrack => {
            crate::bugs::youtrack::get_bug_detail(&auth, &config, &bug_id).await
        }
    }
}

#[tauri::command]
pub async fn disconnect_bug_provider(project_id: String) -> Result<(), String> {
    validate_non_empty(&project_id, "project_id")?;
    store::delete_provider_data(&project_id)
}
