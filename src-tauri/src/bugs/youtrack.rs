use reqwest::Client;
use serde::Deserialize;

use super::provider::{BugItem, BugProvider, ProviderAuth, ProviderConfig};

pub fn get_oauth_url(config: &ProviderConfig, redirect_uri: &str) -> Result<String, String> {
    let base_url = config
        .base_url
        .as_ref()
        .ok_or("YouTrack base_url is required")?;
    let client_id = config
        .client_id
        .as_ref()
        .ok_or("YouTrack client_id is required")?;
    Ok(format!(
        "{}/hub/api/rest/oauth2/auth?response_type=code&client_id={}&redirect_uri={}&scope=YouTrack",
        base_url,
        client_id,
        urlencoding::encode(redirect_uri)
    ))
}

pub async fn exchange_token(
    config: &ProviderConfig,
    code: &str,
    redirect_uri: &str,
) -> Result<ProviderAuth, String> {
    let base_url = config.base_url.as_ref().ok_or("base_url required")?;
    let client_id = config.client_id.as_ref().ok_or("client_id required")?;
    let client_secret = config
        .client_secret
        .as_ref()
        .ok_or("client_secret required")?;

    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: String,
        refresh_token: Option<String>,
        expires_in: Option<u64>,
    }

    let client = Client::new();
    let resp = client
        .post(format!("{}/hub/api/rest/oauth2/token", base_url))
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("redirect_uri", redirect_uri),
        ])
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
        provider: BugProvider::YouTrack,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at,
    })
}

#[derive(Deserialize)]
struct YouTrackIssue {
    id: String,
    #[serde(rename = "idReadable")]
    id_readable: String,
    summary: String,
    description: Option<String>,
    created: Option<i64>,
    updated: Option<i64>,
    fields: Option<Vec<YouTrackField>>,
}

#[derive(Deserialize)]
struct YouTrackField {
    name: String,
    value: Option<YouTrackFieldValue>,
}

#[derive(Deserialize)]
#[serde(untagged)]
#[allow(dead_code)]
enum YouTrackFieldValue {
    Named { name: String },
    Other(serde_json::Value),
}

fn epoch_ms_to_rfc3339(ms: i64) -> String {
    let secs = ms / 1000;
    let nsecs = ((ms % 1000) * 1_000_000) as u32;
    chrono::DateTime::from_timestamp(secs, nsecs)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

fn issue_to_bug_item(issue: YouTrackIssue, base_url: &str) -> BugItem {
    let mut status = String::new();
    let mut priority = None::<String>;
    let mut assignee = None::<String>;

    if let Some(fields) = &issue.fields {
        for field in fields {
            if let Some(YouTrackFieldValue::Named { name }) = &field.value {
                match field.name.as_str() {
                    "State" => status = name.clone(),
                    "Priority" => priority = Some(name.clone()),
                    "Assignee" => assignee = Some(name.clone()),
                    _ => {}
                }
            }
        }
    }

    let created_at = issue.created.map(epoch_ms_to_rfc3339).unwrap_or_default();
    let updated_at = issue.updated.map(epoch_ms_to_rfc3339).unwrap_or_default();

    BugItem {
        id: issue.id,
        key: issue.id_readable.clone(),
        title: issue.summary,
        description: issue.description.unwrap_or_default(),
        status,
        priority,
        assignee,
        labels: vec![],
        url: format!("{}/issue/{}", base_url, issue.id_readable),
        created_at,
        updated_at,
    }
}

pub async fn list_bugs(
    auth: &ProviderAuth,
    config: &ProviderConfig,
) -> Result<Vec<BugItem>, String> {
    let base_url = config
        .base_url
        .as_ref()
        .ok_or("YouTrack base_url is required")?;
    let client = Client::new();

    let query = format!(
        "project: {} type: Bug State: Unresolved",
        config.project_key
    );

    let issues: Vec<YouTrackIssue> = client
        .get(format!("{}/api/issues", base_url))
        .bearer_auth(&auth.access_token)
        .header("Accept", "application/json")
        .query(&[
            ("query", query.as_str()),
            (
                "fields",
                "id,idReadable,summary,description,created,updated,fields(name,value(name))",
            ),
            ("$top", "50"),
        ])
        .send()
        .await
        .map_err(|e| format!("YouTrack API request failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("YouTrack API returned error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse YouTrack issues: {}", e))?;

    Ok(issues
        .into_iter()
        .map(|issue| issue_to_bug_item(issue, base_url))
        .collect())
}

pub async fn get_bug_detail(
    auth: &ProviderAuth,
    config: &ProviderConfig,
    bug_id: &str,
) -> Result<BugItem, String> {
    let base_url = config
        .base_url
        .as_ref()
        .ok_or("YouTrack base_url is required")?;
    let client = Client::new();

    let issue: YouTrackIssue = client
        .get(format!("{}/api/issues/{}", base_url, bug_id))
        .bearer_auth(&auth.access_token)
        .header("Accept", "application/json")
        .query(&[(
            "fields",
            "id,idReadable,summary,description,created,updated,fields(name,value(name))",
        )])
        .send()
        .await
        .map_err(|e| format!("Failed to get YouTrack issue: {}", e))?
        .error_for_status()
        .map_err(|e| format!("YouTrack issue request failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse YouTrack issue: {}", e))?;

    Ok(issue_to_bug_item(issue, base_url))
}
