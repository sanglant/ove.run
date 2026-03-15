use reqwest::Client;
use serde::Deserialize;

use super::provider::{BugItem, BugProvider, ProviderAuth, ProviderConfig};

pub fn get_oauth_url(config: &ProviderConfig, redirect_uri: &str) -> Result<String, String> {
    let client_id = config.client_id.as_ref().ok_or("Jira client_id is required")?;
    Ok(format!(
        "https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id={}&scope=read%3Ajira-work%20read%3Ajira-user&redirect_uri={}&response_type=code&prompt=consent",
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
        refresh_token: Option<String>,
        expires_in: Option<u64>,
    }

    let client = Client::new();
    let resp = client
        .post("https://auth.atlassian.com/oauth/token")
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
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

    let expires_at = token.expires_in.map(|secs| {
        chrono::Utc::now()
            .checked_add_signed(chrono::Duration::seconds(secs as i64))
            .map(|t| t.to_rfc3339())
            .unwrap_or_default()
    });

    Ok(ProviderAuth {
        provider: BugProvider::Jira,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at,
    })
}

async fn get_cloud_id(client: &Client, access_token: &str) -> Result<String, String> {
    #[derive(Deserialize)]
    struct CloudResource {
        id: String,
    }

    let resources: Vec<CloudResource> = client
        .get("https://api.atlassian.com/oauth/token/accessible-resources")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to get resources: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Jira resources request failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse resources: {}", e))?;

    Ok(resources
        .into_iter()
        .next()
        .ok_or("No accessible Jira resources")?
        .id)
}

#[derive(Deserialize)]
struct JiraIssue {
    id: String,
    key: String,
    fields: JiraFields,
}

#[derive(Deserialize)]
struct JiraFields {
    summary: String,
    description: Option<serde_json::Value>,
    status: JiraStatus,
    priority: Option<JiraPriority>,
    assignee: Option<JiraUser>,
    labels: Option<Vec<String>>,
    created: String,
    updated: String,
}

#[derive(Deserialize)]
struct JiraStatus {
    name: String,
}

#[derive(Deserialize)]
struct JiraPriority {
    name: String,
}

#[derive(Deserialize)]
struct JiraUser {
    #[serde(alias = "displayName")]
    display_name: String,
}

fn issue_to_bug_item(issue: JiraIssue, base: &str) -> BugItem {
    let desc = issue
        .fields
        .description
        .map(|d| serde_json::to_string_pretty(&d).unwrap_or_default())
        .unwrap_or_default();

    BugItem {
        id: issue.id,
        key: issue.key.clone(),
        title: issue.fields.summary,
        description: desc,
        status: issue.fields.status.name,
        priority: issue.fields.priority.map(|p| p.name),
        assignee: issue.fields.assignee.map(|a| a.display_name),
        labels: issue.fields.labels.unwrap_or_default(),
        url: format!("{}/browse/{}", base, issue.key),
        created_at: issue.fields.created,
        updated_at: issue.fields.updated,
    }
}

pub async fn list_bugs(auth: &ProviderAuth, config: &ProviderConfig) -> Result<Vec<BugItem>, String> {
    let client = Client::new();
    let cloud_id = get_cloud_id(&client, &auth.access_token).await?;

    let jql = format!(
        "project = {} AND issuetype = Bug AND statusCategory != Done ORDER BY updated DESC",
        config.project_key
    );

    #[derive(Deserialize)]
    struct SearchResponse {
        issues: Vec<JiraIssue>,
    }

    let resp: SearchResponse = client
        .get(format!(
            "https://api.atlassian.com/ex/jira/{}/rest/api/3/search",
            cloud_id
        ))
        .bearer_auth(&auth.access_token)
        .query(&[("jql", &jql), ("maxResults", &"50".to_string())])
        .send()
        .await
        .map_err(|e| format!("Jira search failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Jira search returned error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse search results: {}", e))?;

    let base = config
        .base_url
        .as_deref()
        .unwrap_or("https://your-domain.atlassian.net");

    Ok(resp
        .issues
        .into_iter()
        .map(|issue| issue_to_bug_item(issue, base))
        .collect())
}

pub async fn get_bug_detail(
    auth: &ProviderAuth,
    config: &ProviderConfig,
    bug_id: &str,
) -> Result<BugItem, String> {
    let client = Client::new();
    let cloud_id = get_cloud_id(&client, &auth.access_token).await?;

    let issue: JiraIssue = client
        .get(format!(
            "https://api.atlassian.com/ex/jira/{}/rest/api/3/issue/{}",
            cloud_id, bug_id
        ))
        .bearer_auth(&auth.access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to get issue: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Jira issue request failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse issue: {}", e))?;

    let base = config
        .base_url
        .as_deref()
        .unwrap_or("https://your-domain.atlassian.net");

    Ok(issue_to_bug_item(issue, base))
}
