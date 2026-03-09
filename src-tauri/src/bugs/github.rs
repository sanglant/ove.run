use reqwest::Client;
use serde::Deserialize;

use super::provider::{BugItem, BugProvider, ProviderAuth, ProviderConfig};

pub fn get_oauth_url(config: &ProviderConfig, redirect_uri: &str) -> Result<String, String> {
    let client_id = config.client_id.as_ref().ok_or("GitHub client_id is required")?;
    Ok(format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=repo",
        client_id,
        urlencoding::encode(redirect_uri)
    ))
}

pub async fn exchange_token(
    config: &ProviderConfig,
    code: &str,
    redirect_uri: &str,
) -> Result<ProviderAuth, String> {
    let client_id = config.client_id.as_ref().ok_or("client_id required")?;
    let client_secret = config.client_secret.as_ref().ok_or("client_secret required")?;

    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: String,
        token_type: Option<String>,
    }

    let client = Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    let token: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token: {}", e))?;

    // Suppress unused field warning
    let _ = token.token_type;

    Ok(ProviderAuth {
        provider: BugProvider::GithubProjects,
        access_token: token.access_token,
        refresh_token: None,
        expires_at: None,
    })
}

fn parse_owner_repo(project_key: &str) -> Result<(&str, &str), String> {
    let mut parts = project_key.splitn(2, '/');
    let owner = parts.next().ok_or("project_key must be in owner/repo format")?;
    let repo = parts
        .next()
        .ok_or("project_key must be in owner/repo format")?;
    Ok((owner, repo))
}

#[derive(Deserialize)]
struct GitHubIssue {
    id: u64,
    number: u64,
    title: String,
    body: Option<String>,
    state: String,
    html_url: String,
    labels: Vec<GitHubLabel>,
    assignee: Option<GitHubUser>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct GitHubLabel {
    name: String,
}

#[derive(Deserialize)]
struct GitHubUser {
    login: String,
}

fn issue_to_bug_item(issue: GitHubIssue) -> BugItem {
    BugItem {
        id: issue.id.to_string(),
        key: format!("#{}", issue.number),
        title: issue.title,
        description: issue.body.unwrap_or_default(),
        status: issue.state,
        priority: None,
        assignee: issue.assignee.map(|a| a.login),
        labels: issue.labels.into_iter().map(|l| l.name).collect(),
        url: issue.html_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
    }
}

pub async fn list_bugs(auth: &ProviderAuth, config: &ProviderConfig) -> Result<Vec<BugItem>, String> {
    let (owner, repo) = parse_owner_repo(&config.project_key)?;
    let client = Client::new();

    let issues: Vec<GitHubIssue> = client
        .get(format!(
            "https://api.github.com/repos/{}/{}/issues",
            owner, repo
        ))
        .bearer_auth(&auth.access_token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "agentic-app")
        .query(&[("state", "open"), ("per_page", "50")])
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("GitHub API returned error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub issues: {}", e))?;

    Ok(issues.into_iter().map(issue_to_bug_item).collect())
}

pub async fn get_bug_detail(
    auth: &ProviderAuth,
    config: &ProviderConfig,
    bug_id: &str,
) -> Result<BugItem, String> {
    let (owner, repo) = parse_owner_repo(&config.project_key)?;
    let client = Client::new();

    let issue: GitHubIssue = client
        .get(format!(
            "https://api.github.com/repos/{}/{}/issues/{}",
            owner, repo, bug_id
        ))
        .bearer_auth(&auth.access_token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "agentic-app")
        .send()
        .await
        .map_err(|e| format!("Failed to get GitHub issue: {}", e))?
        .error_for_status()
        .map_err(|e| format!("GitHub issue request failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub issue: {}", e))?;

    Ok(issue_to_bug_item(issue))
}
