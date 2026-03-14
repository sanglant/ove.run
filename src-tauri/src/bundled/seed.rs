use rusqlite::Connection;
use crate::db::context;
use crate::db::settings;
use crate::state::ContextUnit;
use super::personas::BUNDLED_PERSONAS;
use super::skills::BUNDLED_SKILLS;
use super::personas::BundledUnit;

const SEED_VERSION_KEY: &str = "bundled_seed_version";
const CURRENT_SEED_VERSION: &str = "2";

/// Sync bundled content with the database.
/// On version mismatch: upserts all bundled units by slug.
pub fn sync_bundled_content(conn: &Connection) -> Result<(), String> {
    let current = settings::get_setting(conn, SEED_VERSION_KEY)
        .map_err(|e| e.to_string())?;

    if current.as_deref() == Some(CURRENT_SEED_VERSION) {
        return Ok(());
    }

    let mut active_slugs: Vec<&str> = Vec::new();

    for bundled in BUNDLED_PERSONAS {
        upsert_bundled(conn, bundled)?;
        active_slugs.push(bundled.slug);
    }

    for bundled in BUNDLED_SKILLS {
        upsert_bundled(conn, bundled)?;
        active_slugs.push(bundled.slug);
    }

    // Mark removed bundled units as non-bundled
    if !active_slugs.is_empty() {
        let placeholders: Vec<String> = active_slugs.iter().enumerate()
            .map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "UPDATE context_units SET is_bundled = 0 WHERE is_bundled = 1 AND bundled_slug NOT IN ({})",
            placeholders.join(", ")
        );
        let params: Vec<&dyn rusqlite::types::ToSql> = active_slugs.iter()
            .map(|s| s as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
    }

    settings::set_setting(conn, SEED_VERSION_KEY, CURRENT_SEED_VERSION)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn upsert_bundled(conn: &Connection, bundled: &BundledUnit) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let unit = ContextUnit {
        id: uuid::Uuid::new_v4().to_string(),
        project_id: None,
        name: bundled.name.to_string(),
        unit_type: bundled.unit_type.to_string(),
        scope: "global".to_string(),
        tags_json: "[]".to_string(),
        l0_summary: Some(bundled.l0_summary.to_string()),
        l1_overview: Some(bundled.l1_overview.to_string()),
        l2_content: Some(bundled.l2_content.to_string()),
        created_at: now.clone(),
        updated_at: now,
    };
    context::upsert_bundled_unit(conn, &unit, bundled.slug)
        .map_err(|e| e.to_string())
}
