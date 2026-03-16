use chrono::Utc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::commands::project_commands::run_arbiter_cli;
use crate::db::init::DbPool;
use crate::db::memory;
use crate::state::Consolidation;

pub enum MemoryWorkerEvent {
    ConsolidateProject { project_id: String, project_path: String },
    PruneProject { project_id: String },
    Shutdown,
}

const CONSOLIDATION_THRESHOLD: i64 = 10;
const CONSOLIDATION_BATCH: usize = 20;

const CONSOLIDATION_PROMPT_TEMPLATE: &str = r#"You are distilling a set of memories from AI coding agent sessions. Your job is to separate signal from noise and produce a compact summary that preserves only what matters for future work.

Memories to consolidate:
{memories}

Discard memories that are:
- Routine operations anyone could re-derive from the code
- Temporary state that is no longer relevant
- Duplicate or near-duplicate of another memory
- Low-importance details that don't affect future decisions

Respond with exactly two lines:
SUMMARY: <distilled summary of decisions, patterns, and facts worth keeping — 2-3 sentences, no filler>
INSIGHT: <the single most actionable takeaway for future sessions, 1 sentence>"#;

pub async fn run_memory_worker(db: DbPool, mut rx: mpsc::Receiver<MemoryWorkerEvent>) {
    while let Some(event) = rx.recv().await {
        match event {
            MemoryWorkerEvent::ConsolidateProject { project_id, project_path } => {
                if let Err(e) = consolidate_project(&db, &project_id, &project_path).await {
                    tracing::error!("[memory_worker] consolidation error for {}: {}", project_id, e);
                }
            }
            MemoryWorkerEvent::PruneProject { project_id } => {
                if let Err(e) = prune_project(&db, &project_id) {
                    tracing::warn!("[memory_worker] prune error for {}: {}", project_id, e);
                }
            }
            MemoryWorkerEvent::Shutdown => break,
        }
    }
}

fn prune_project(db: &DbPool, project_id: &str) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let pruned = memory::prune_decayed_memories(&conn, project_id)
        .map_err(|e| e.to_string())?;
    if pruned > 0 {
        tracing::info!("[memory_worker] pruned {} decayed memories for {}", pruned, project_id);
    }
    Ok(())
}

async fn consolidate_project(db: &DbPool, project_id: &str, project_path: &str) -> Result<(), String> {
    // 1. Check if there are enough unconsolidated memories
    let count = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        memory::count_unconsolidated(&conn, project_id)
            .map_err(|e| e.to_string())?
    };

    if count < CONSOLIDATION_THRESHOLD {
        return Ok(());
    }

    // 2. Get top unconsolidated memories
    let memories = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        memory::get_unconsolidated_memories(&conn, project_id, CONSOLIDATION_BATCH)
            .map_err(|e| e.to_string())?
    };

    if memories.is_empty() {
        return Ok(());
    }

    // 3. Read arbiter settings from db
    let (cli_command, model) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let settings = crate::db::settings::load_app_settings(&conn);
        let provider = settings.global.arbiter_provider.clone();
        let model = settings.global.arbiter_model.clone();
        let command = match provider.as_str() {
            "" => "claude".to_string(),
            "claude" => "claude".to_string(),
            "gemini" => "gemini".to_string(),
            "copilot" => "copilot".to_string(),
            "codex" => "codex".to_string(),
            other => other.to_string(),
        };
        (command, if model.is_empty() { None } else { Some(model) })
    };

    // 4. Build prompt with memory contents
    let memories_text = memories
        .iter()
        .enumerate()
        .map(|(i, m)| format!("{}. [importance={:.2}] {}", i + 1, m.importance, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = CONSOLIDATION_PROMPT_TEMPLATE.replace("{memories}", &memories_text);

    // 5. Call arbiter
    let response = run_arbiter_cli(&prompt, project_path, &cli_command, model.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    // 6. Parse SUMMARY: and INSIGHT: lines
    let mut summary = String::new();
    let mut insight = String::new();

    for line in response.lines() {
        let line = line.trim();
        if line.starts_with("SUMMARY:") {
            summary = line.trim_start_matches("SUMMARY:").trim().to_string();
        } else if line.starts_with("INSIGHT:") {
            insight = line.trim_start_matches("INSIGHT:").trim().to_string();
        }
    }

    if summary.is_empty() || insight.is_empty() {
        return Err(format!(
            "Arbiter response did not contain SUMMARY/INSIGHT lines. Got: {}",
            &response[..response.len().min(200)]
        ));
    }

    // 7. Create Consolidation entry
    let source_ids: Vec<String> = memories.iter().map(|m| m.id.clone()).collect();
    let source_ids_json = serde_json::to_string(&source_ids)
        .unwrap_or_else(|_| "[]".to_string());

    let consolidation = Consolidation {
        id: Uuid::new_v4().to_string(),
        project_id: project_id.to_string(),
        source_ids_json,
        summary,
        insight,
        created_at: Utc::now().to_rfc3339(),
    };

    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        memory::create_consolidation(&conn, &consolidation)
            .map_err(|e| e.to_string())?;
    }

    // 8. Mark source memories as consolidated
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        memory::mark_memories_consolidated(&conn, &source_ids)
            .map_err(|e| e.to_string())?;
    }

    tracing::info!(
        "[memory_worker] consolidated {} memories into {} for project {}",
        source_ids.len(),
        consolidation.id,
        project_id
    );

    Ok(())
}
