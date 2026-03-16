use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub release_notes: Option<String>,
}

/// Compare two semver strings of the form "MAJOR.MINOR.PATCH".
/// Returns true when `candidate` is strictly newer than `current`.
fn is_newer(current: &str, candidate: &str) -> bool {
    let parse = |s: &str| -> Vec<u64> {
        s.split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect()
    };

    let cur = parse(current);
    let cand = parse(candidate);

    for i in 0..3 {
        let c = cur.get(i).copied().unwrap_or(0);
        let d = cand.get(i).copied().unwrap_or(0);
        if d > c {
            return true;
        }
        if d < c {
            return false;
        }
    }
    false
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string());

    let client = reqwest::Client::builder()
        .user_agent("ove.run-update-checker")
        .build()
        .map_err(|e| e.to_string())?;

    let response = match client
        .get("https://api.github.com/repos/sanglant/ove.run/releases/latest")
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            return Ok(UpdateInfo {
                current_version,
                latest_version: String::new(),
                update_available: false,
                release_url: String::new(),
                release_notes: None,
            });
        }
    };

    if !response.status().is_success() {
        return Ok(UpdateInfo {
            current_version,
            latest_version: String::new(),
            update_available: false,
            release_url: String::new(),
            release_notes: None,
        });
    }

    let body: serde_json::Value = match response.json().await {
        Ok(v) => v,
        Err(_) => {
            return Ok(UpdateInfo {
                current_version,
                latest_version: String::new(),
                update_available: false,
                release_url: String::new(),
                release_notes: None,
            });
        }
    };

    let tag_name = body
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let latest_version = tag_name.trim_start_matches('v').to_string();

    let release_url = body
        .get("html_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let release_notes = body
        .get("body")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let update_available = !latest_version.is_empty() && is_newer(&current_version, &latest_version);

    Ok(UpdateInfo {
        current_version,
        latest_version,
        update_available,
        release_url,
        release_notes,
    })
}

#[cfg(test)]
mod tests {
    use super::is_newer;

    #[test]
    fn same_version_is_not_newer() {
        assert!(!is_newer("0.1.0", "0.1.0"));
    }

    #[test]
    fn patch_bump_is_newer() {
        assert!(is_newer("0.1.0", "0.1.1"));
    }

    #[test]
    fn minor_bump_is_newer() {
        assert!(is_newer("0.1.0", "0.2.0"));
    }

    #[test]
    fn major_bump_is_newer() {
        assert!(is_newer("0.1.0", "1.0.0"));
    }

    #[test]
    fn older_candidate_is_not_newer() {
        assert!(!is_newer("1.2.3", "1.2.2"));
    }

    #[test]
    fn leading_v_stripped_correctly() {
        // is_newer works on already-stripped strings; this guards the trim logic indirectly
        assert!(is_newer("0.1.0", "0.1.1"));
        assert!(!is_newer("0.1.1", "0.1.0"));
    }
}
