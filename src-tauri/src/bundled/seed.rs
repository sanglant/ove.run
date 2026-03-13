use rusqlite::Connection;
use crate::db::context;
use crate::db::settings;
use crate::state::ContextUnit;
use super::personas::BUNDLED_PERSONAS;
use super::skills::BUNDLED_SKILLS;
use super::personas::BundledUnit;

const SEED_VERSION_KEY: &str = "bundled_seed_version";
const CURRENT_SEED_VERSION: &str = "1";

pub fn seed_bundled_content(conn: &Connection) -> Result<(), String> {
    // Check if already seeded
    let current = settings::get_setting(conn, SEED_VERSION_KEY)
        .map_err(|e| e.to_string())?;

    if current.as_deref() == Some(CURRENT_SEED_VERSION) {
        return Ok(()); // Already seeded
    }

    // Insert all personas
    for bundled in BUNDLED_PERSONAS {
        insert_bundled_unit(conn, bundled)?;
    }

    // Insert all skills
    for bundled in BUNDLED_SKILLS {
        insert_bundled_unit(conn, bundled)?;
    }

    // Mark as seeded
    settings::set_setting(conn, SEED_VERSION_KEY, CURRENT_SEED_VERSION)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn insert_bundled_unit(conn: &Connection, bundled: &BundledUnit) -> Result<(), String> {
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
    context::create_context_unit(conn, &unit)
        .map_err(|e| e.to_string())
}
