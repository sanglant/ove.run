use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use super::provider::{BugProvider, ProviderAuth, ProviderConfig};

pub struct OAuthStartResult {
    pub auth_url: String,
    pub port: u16,
}

pub async fn start_oauth(
    config: &ProviderConfig,
    redirect_uri: &str,
) -> Result<OAuthStartResult, String> {
    let auth_url = match config.provider {
        BugProvider::Jira => super::jira::get_oauth_url(config, redirect_uri),
        BugProvider::GithubProjects => super::github::get_oauth_url(config, redirect_uri),
        BugProvider::YouTrack => super::youtrack::get_oauth_url(config, redirect_uri),
    }?;

    Ok(OAuthStartResult { auth_url, port: 0 })
}

pub async fn wait_for_callback(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;

    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    let code = extract_code_from_request(&request)?;

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h2>Authentication successful!</h2><p>You can close this tab.</p></body></html>";
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|e| e.to_string())?;

    Ok(code)
}

fn extract_code_from_request(request: &str) -> Result<String, String> {
    let first_line = request.lines().next().ok_or("Empty request")?;
    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or("No path in request")?;
    let query = path.split('?').nth(1).ok_or("No query parameters")?;

    for param in query.split('&') {
        let mut parts = param.splitn(2, '=');
        if parts.next() == Some("code") {
            return parts
                .next()
                .map(|s| s.to_string())
                .ok_or("No code value".to_string());
        }
    }

    Err("No code parameter found".to_string())
}

pub async fn exchange_token(
    config: &ProviderConfig,
    code: &str,
    redirect_uri: &str,
) -> Result<ProviderAuth, String> {
    match config.provider {
        BugProvider::Jira => super::jira::exchange_token(config, code, redirect_uri).await,
        BugProvider::GithubProjects => {
            super::github::exchange_token(config, code, redirect_uri).await
        }
        BugProvider::YouTrack => super::youtrack::exchange_token(config, code, redirect_uri).await,
    }
}
