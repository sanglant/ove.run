use serde::Serialize;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::RwLock;

use crate::arbiter::actions::ArbiterAction;
use crate::arbiter::dispatch;
use crate::agents::registry::get_agent_definitions;
use crate::db::arbiter_state;
use crate::db::context::list_l0_summaries;
use crate::db::init::DbPool;
use crate::db::memory::search_memories;
use crate::db::settings::load_app_settings;
use crate::db::stories;
use crate::loop_engine::circuit_breaker::{check_circuit_breakers, CircuitBreakerAction};
use crate::loop_engine::prompt_delivery::build_spawn_args;
use crate::loop_engine::quality_gates::{all_gates_passed, run_quality_gates};
use crate::memory_worker::MemoryWorkerEvent;
use crate::pty::manager::PtyManager;
use crate::state::{ArbiterStateRow, QualityGateConfig, Story, TrustLevel};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum LoopCommand {
    Start {
        project_id: String,
        project_path: String,
        user_request: Option<String>,
        session_id: Option<String>,
    },
    Pause,
    Resume,
    Cancel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum LoopEvent {
    StatusChanged { status: String },
    StoryStarted { story_id: String },
    StoryCompleted { story_id: String },
    StoryFailed { story_id: String, reason: String },
    IterationCompleted { count: i32, max: i32 },
    GateResult { story_id: String, gate: String, passed: bool, output: String },
    CircuitBreakerTriggered { reason: String },
    StoriesUpdated { project_id: String },
    LoopCompleted,
    LoopFailed { reason: String },
    ReasoningEntry { action: String, reasoning: String },
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub async fn run_loop(
    db: DbPool,
    pty_manager: Arc<RwLock<PtyManager>>,
    app_handle: tauri::AppHandle,
    mut cmd_rx: mpsc::Receiver<LoopCommand>,
    event_tx: mpsc::Sender<LoopEvent>,
    memory_worker_tx: mpsc::Sender<MemoryWorkerEvent>,
) {
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            LoopCommand::Start { project_id, project_path, user_request, session_id } => {
                run_loop_lifecycle(
                    &db,
                    &pty_manager,
                    &app_handle,
                    &mut cmd_rx,
                    &event_tx,
                    &memory_worker_tx,
                    &project_id,
                    &project_path,
                    user_request.as_deref(),
                    session_id,
                )
                .await;
            }
            // Pause/Resume/Cancel are no-ops when the loop is not running.
            _ => {}
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers — all return Result so a poisoned mutex never panics the engine
// ---------------------------------------------------------------------------

fn lock_db(db: &DbPool) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, String> {
    db.lock().map_err(|e| format!("db lock poisoned: {e}"))
}

/// Load or create arbiter state for the project.
fn load_or_init_state(db: &DbPool, project_id: &str) -> Result<ArbiterStateRow, String> {
    let conn = lock_db(db)?;
    match arbiter_state::get_arbiter_state(&conn, project_id) {
        Ok(Some(s)) => Ok(s),
        _ => {
            let s = ArbiterStateRow {
                project_id: project_id.to_string(),
                trust_level: TrustLevel::Autonomous,
                loop_status: "idle".to_string(),
                current_story_id: None,
                iteration_count: 0,
                max_iterations: 10,
                last_activity_at: None,
            };
            let _ = arbiter_state::upsert_arbiter_state(&conn, &s);
            Ok(s)
        }
    }
}

/// Persist loop_status to DB and emit StatusChanged event.
async fn set_status(
    db: &DbPool,
    event_tx: &mpsc::Sender<LoopEvent>,
    project_id: &str,
    status: &str,
) -> Result<(), String> {
    {
        let conn = lock_db(db)?;
        let _ = arbiter_state::set_loop_status(&conn, project_id, status);
    }
    let _ = event_tx.send(LoopEvent::StatusChanged { status: status.to_string() }).await;
    Ok(())
}

/// Like `set_status` but logs DB errors rather than propagating — used in
/// fire-and-forget contexts where the loop must continue regardless.
async fn set_status_best_effort(
    db: &DbPool,
    event_tx: &mpsc::Sender<LoopEvent>,
    project_id: &str,
    status: &str,
) {
    if let Err(e) = set_status(db, event_tx, project_id, status).await {
        tracing::error!("[loop_engine] set_status({status}) failed: {e}");
    }
}

/// Load quality gate config from the settings table.
fn load_quality_gate_config(db: &DbPool, project_id: &str) -> Result<QualityGateConfig, String> {
    let conn = lock_db(db)?;
    let key = format!("quality_gates_{}", project_id);
    match crate::db::settings::get_setting(&conn, &key) {
        Ok(Some(json)) => Ok(serde_json::from_str(&json).unwrap_or_default()),
        _ => Ok(QualityGateConfig::default()),
    }
}

/// Derive arbiter CLI command from settings.
fn arbiter_cli_command(db: &DbPool) -> Result<(String, Option<String>), String> {
    let conn = lock_db(db)?;
    let settings = load_app_settings(&conn);
    let provider = settings.global.arbiter_provider.clone();
    let model = settings.global.arbiter_model.clone();
    let command = match provider.as_str() {
        "" | "claude" => "claude".to_string(),
        other => other.to_string(),
    };
    Ok((command, if model.is_empty() { None } else { Some(model) }))
}

/// Build the prompt text that will be delivered to the agent for a story.
fn build_story_prompt(story: &Story, memories_ctx: &str, l0_ctx: &str) -> String {
    let mut parts: Vec<String> = Vec::new();

    parts.push(format!("# Task: {}", story.title));
    parts.push(String::new());
    parts.push(format!("## Description\n{}", story.description));

    if let Some(ac) = &story.acceptance_criteria {
        if !ac.is_empty() {
            parts.push(format!("## Acceptance Criteria\n{}", ac));
        }
    }

    if !memories_ctx.is_empty() {
        parts.push(format!("## Relevant Context from Memory\n{}", memories_ctx));
    }

    if !l0_ctx.is_empty() {
        parts.push(format!("## Project Context Summaries\n{}", l0_ctx));
    }

    parts.join("\n\n")
}

// ---------------------------------------------------------------------------
// Main lifecycle
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
async fn run_loop_lifecycle(
    db: &DbPool,
    pty_manager: &Arc<RwLock<PtyManager>>,
    _app_handle: &tauri::AppHandle,
    cmd_rx: &mut mpsc::Receiver<LoopCommand>,
    event_tx: &mpsc::Sender<LoopEvent>,
    memory_worker_tx: &mpsc::Sender<MemoryWorkerEvent>,
    project_id: &str,
    project_path: &str,
    user_request: Option<&str>,
    session_id: Option<String>,
) {
    // -----------------------------------------------------------------------
    // Phase: Planning — decompose user_request into stories if provided
    // -----------------------------------------------------------------------

    set_status_best_effort(db, event_tx, project_id, "planning").await;

    if let Some(request) = user_request {
        let (cli_command, model) = match arbiter_cli_command(db) {
            Ok(v) => v,
            Err(e) => {
                let _ = event_tx
                    .send(LoopEvent::LoopFailed { reason: format!("Settings unavailable: {e}") })
                    .await;
                return;
            }
        };

        // Load context units and memories for decompose action
        let project_context = match lock_db(db) {
            Ok(conn) => crate::db::context::list_context_units(&conn, Some(project_id))
                .unwrap_or_default(),
            Err(e) => {
                tracing::error!("[loop_engine] context load failed: {e}");
                vec![]
            }
        };

        let memories = match lock_db(db) {
            Ok(conn) => search_memories(&conn, request, project_id, None, 10).unwrap_or_default(),
            Err(e) => {
                tracing::error!("[loop_engine] memory search failed: {e}");
                vec![]
            }
        };

        let action = ArbiterAction::DecomposeRequest {
            user_request: request.to_string(),
            project_context,
            memories,
        };

        match dispatch::dispatch(action, project_path, &cli_command, model.as_deref()).await {
            Ok(response) => {
                if let Some(drafts) = response.stories {
                    match lock_db(db) {
                        Ok(conn) => {
                            let now = chrono::Utc::now().to_rfc3339();
                            for draft in drafts {
                                let story = Story {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    project_id: project_id.to_string(),
                                    title: draft.title,
                                    description: draft.description,
                                    acceptance_criteria: Some(draft.acceptance_criteria),
                                    priority: draft.priority,
                                    status: "pending".to_string(),
                                    depends_on_json: serde_json::to_string(&draft.depends_on)
                                        .unwrap_or_else(|_| "[]".to_string()),
                                    iteration_attempts: 0,
                                    created_at: now.clone(),
                                };
                                let _ = stories::create_story(&conn, &story);
                            }
                        }
                        Err(e) => {
                            let _ = event_tx
                                .send(LoopEvent::LoopFailed {
                                    reason: format!("Failed to persist stories: {e}"),
                                })
                                .await;
                            return;
                        }
                    }

                    // Notify frontend to reload stories
                    let _ = event_tx
                        .send(LoopEvent::StoriesUpdated { project_id: project_id.to_string() })
                        .await;

                    if let Some(reasoning) = response.reasoning {
                        let _ = event_tx
                            .send(LoopEvent::ReasoningEntry {
                                action: "DecomposeRequest".to_string(),
                                reasoning,
                            })
                            .await;
                    }
                }
            }
            Err(e) => {
                let _ = event_tx
                    .send(LoopEvent::LoopFailed {
                        reason: format!("Failed to decompose request: {}", e),
                    })
                    .await;
                return;
            }
        }
    }

    set_status_best_effort(db, event_tx, project_id, "running").await;

    // -----------------------------------------------------------------------
    // Phase: Iteration loop
    // -----------------------------------------------------------------------

    let mut consecutive_no_commit: i32 = 0;

    loop {
        // Check for Pause/Cancel commands (non-blocking)
        match cmd_rx.try_recv() {
            Ok(LoopCommand::Pause) => {
                set_status_best_effort(db, event_tx, project_id, "paused").await;
                // Wait for Resume or Cancel
                loop {
                    match cmd_rx.recv().await {
                        Some(LoopCommand::Resume) => {
                            set_status_best_effort(db, event_tx, project_id, "running").await;
                            break;
                        }
                        Some(LoopCommand::Cancel) | None => {
                            set_status_best_effort(db, event_tx, project_id, "idle").await;
                            return;
                        }
                        _ => {}
                    }
                }
            }
            Ok(LoopCommand::Cancel) => {
                set_status_best_effort(db, event_tx, project_id, "idle").await;
                return;
            }
            _ => {}
        }

        // Load current arbiter state
        let arbiter_st = match load_or_init_state(db, project_id) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!("[loop_engine] load_or_init_state failed: {e}; using defaults");
                ArbiterStateRow {
                    project_id: project_id.to_string(),
                    trust_level: TrustLevel::Autonomous,
                    loop_status: "running".to_string(),
                    current_story_id: None,
                    iteration_count: 0,
                    max_iterations: 10,
                    last_activity_at: None,
                }
            }
        };

        // Check if max iterations reached
        if arbiter_st.iteration_count >= arbiter_st.max_iterations {
            let reason = format!("Max iterations ({}) reached", arbiter_st.max_iterations);
            let _ = event_tx.send(LoopEvent::CircuitBreakerTriggered { reason: reason.clone() }).await;
            let _ = event_tx.send(LoopEvent::LoopFailed { reason }).await;
            set_status_best_effort(db, event_tx, project_id, "failed").await;
            return;
        }

        // Get next story
        let story = match lock_db(db) {
            Ok(conn) => stories::get_next_story(&conn, project_id).unwrap_or(None),
            Err(e) => {
                tracing::error!("[loop_engine] get_next_story failed: {e}; retrying next iteration");
                continue;
            }
        };

        let story = match story {
            Some(s) => s,
            None => {
                // No pending stories — check if all complete
                let all_done = match lock_db(db) {
                    Ok(conn) => stories::all_stories_complete(&conn, project_id).unwrap_or(false),
                    Err(e) => {
                        tracing::error!("[loop_engine] all_stories_complete failed: {e}");
                        false
                    }
                };
                if all_done {
                    let _ = event_tx.send(LoopEvent::LoopCompleted).await;
                    set_status_best_effort(db, event_tx, project_id, "completed").await;
                } else {
                    // Blocked by unsatisfied dependencies — cannot progress
                    let _ = event_tx
                        .send(LoopEvent::LoopFailed {
                            reason: "No actionable stories: all remaining stories have unsatisfied dependencies".to_string(),
                        })
                        .await;
                    set_status_best_effort(db, event_tx, project_id, "failed").await;
                }
                return;
            }
        };

        // Circuit breaker check
        match check_circuit_breakers(&arbiter_st, &story, consecutive_no_commit) {
            CircuitBreakerAction::Pause(reason) => {
                let _ = event_tx
                    .send(LoopEvent::CircuitBreakerTriggered { reason: reason.clone() })
                    .await;
                set_status_best_effort(db, event_tx, project_id, "paused").await;
                // Wait for an explicit Resume or Cancel
                loop {
                    match cmd_rx.recv().await {
                        Some(LoopCommand::Resume) => {
                            set_status_best_effort(db, event_tx, project_id, "running").await;
                            break;
                        }
                        Some(LoopCommand::Cancel) | None => {
                            set_status_best_effort(db, event_tx, project_id, "idle").await;
                            return;
                        }
                        _ => {}
                    }
                }
                continue;
            }
            CircuitBreakerAction::Stop(reason) => {
                let _ = event_tx
                    .send(LoopEvent::CircuitBreakerTriggered { reason: reason.clone() })
                    .await;
                let _ = event_tx.send(LoopEvent::LoopFailed { reason }).await;
                set_status_best_effort(db, event_tx, project_id, "failed").await;
                return;
            }
            CircuitBreakerAction::Continue => {}
        }

        // Set current story in state
        if let Ok(conn) = lock_db(db) {
            let _ = arbiter_state::set_current_story(&conn, project_id, Some(&story.id));
        }

        let _ = event_tx
            .send(LoopEvent::StoryStarted { story_id: story.id.clone() })
            .await;

        // -------------------------------------------------------------------
        // Phase: Agent execution
        // -------------------------------------------------------------------

        // Resolve agent definition (prefer project-configured type, fallback to claude)
        let agent_type_key = match lock_db(db) {
            Ok(conn) => match conn.query_row(
                "SELECT arbiter_agent_type FROM projects WHERE id = ?1",
                rusqlite::params![project_id],
                |row| row.get::<_, Option<String>>(0),
            ) {
                Ok(t) => t.unwrap_or_else(|| "claude".to_string()),
                Err(_) => "claude".to_string(),
            },
            Err(e) => {
                tracing::warn!("[loop_engine] agent_type query failed: {e}; using claude");
                "claude".to_string()
            }
        };

        let agent_defs = get_agent_definitions();
        let agent_def = agent_defs
            .iter()
            .find(|d| format!("{:?}", d.agent_type).to_lowercase() == agent_type_key.to_lowercase())
            .or_else(|| agent_defs.first())
            .expect("at least one agent definition exists");

        // Build context prompt
        let memories_text = match lock_db(db) {
            Ok(conn) => {
                let query = format!("{} {}", story.title, story.description);
                let mems = search_memories(&conn, &query, project_id, None, 5).unwrap_or_default();
                mems.iter()
                    .map(|m| format!("- {}", m.content))
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            Err(e) => {
                tracing::error!("[loop_engine] memory search failed: {e}");
                String::new()
            }
        };

        let l0_text = match lock_db(db) {
            Ok(conn) => {
                let summaries = list_l0_summaries(&conn, project_id).unwrap_or_default();
                summaries
                    .iter()
                    .map(|(_, name, summary)| format!("- {}: {}", name, summary))
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            Err(e) => {
                tracing::error!("[loop_engine] l0 summaries failed: {e}");
                String::new()
            }
        };

        let prompt = build_story_prompt(&story, &memories_text, &l0_text);

        // Retrieve yolo mode from agent settings
        let yolo_mode = match lock_db(db) {
            Ok(conn) => {
                let settings = load_app_settings(&conn);
                settings
                    .agents
                    .get(&agent_type_key)
                    .map(|s| s.default_yolo_mode)
                    .unwrap_or(false)
            }
            Err(e) => {
                tracing::warn!("[loop_engine] yolo_mode load failed: {e}; defaulting to false");
                false
            }
        };

        // Build spawn args (used for CliFlag/PositionalArg delivery; for
        // InteractiveInput the args do not include the prompt)
        let spawn_args = build_spawn_args(agent_def, &prompt, yolo_mode);

        // Resolve PTY session ID: reuse the caller-provided session when
        // available, otherwise generate a unique ID per story.
        let pty_session_id = match &session_id {
            Some(sid) => sid.clone(),
            None => format!("loop-{}-{}", project_id, story.id),
        };

        // Kill previous agent in this session before respawning for next story
        if session_id.is_some() {
            let mut pm = pty_manager.write().await;
            let _ = pm.kill(&pty_session_id);
        }

        let agent_env = match lock_db(db) {
            Ok(conn) => {
                let settings = load_app_settings(&conn);
                settings
                    .agents
                    .get(&agent_type_key)
                    .map(|s| s.env_vars.clone())
                    .unwrap_or_default()
            }
            Err(e) => {
                tracing::warn!("[loop_engine] agent_env load failed: {e}; using empty env");
                std::collections::HashMap::new()
            }
        };

        {
            let mut pm = pty_manager.write().await;
            if let Err(e) = pm.spawn(
                pty_session_id.clone(),
                agent_def.command.clone(),
                spawn_args,
                project_path.to_string(),
                agent_env,
                220,
                50,
                _app_handle.clone(),
            ) {
                tracing::error!("[loop_engine] PTY spawn error for {}: {}", story.id, e);
            } else if matches!(
                &agent_def.prompt_delivery,
                Some(crate::state::PromptDelivery::InteractiveInput)
            ) {
                // Deliver prompt via PTY write after a brief startup delay
                drop(pm); // release write lock before sleeping
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let bytes = crate::loop_engine::prompt_delivery::deliver_interactive_prompt(&prompt);
                let mut pm2 = pty_manager.write().await;
                let _ = pm2.write(&pty_session_id, bytes);
            }
        }

        // Take the exit receiver before entering the select so we can detect
        // process exit without waiting for the full timeout.
        let exit_rx = {
            let mut pm = pty_manager.write().await;
            pm.take_exit_rx(&pty_session_id)
        };

        // Wait for: (a) agent process exit, (b) a loop command, or (c) timeout
        let agent_timeout = tokio::time::Duration::from_secs(60 * 10); // 10 minute cap per story

        let cancelled = if let Some(exit_rx) = exit_rx {
            tokio::select! {
                _ = exit_rx => {
                    // PTY process exited naturally — proceed to quality gates
                    false
                }
                cmd = cmd_rx.recv() => {
                    handle_agent_wait_cmd(cmd, db, event_tx, pty_manager, &pty_session_id, project_id, cmd_rx).await
                }
                _ = tokio::time::sleep(agent_timeout) => {
                    // Timeout — proceed to quality gates
                    false
                }
            }
        } else {
            // exit_rx unavailable (already taken or spawn failed) — fall back to timeout only
            tokio::select! {
                cmd = cmd_rx.recv() => {
                    handle_agent_wait_cmd(cmd, db, event_tx, pty_manager, &pty_session_id, project_id, cmd_rx).await
                }
                _ = tokio::time::sleep(agent_timeout) => {
                    false
                }
            }
        };

        if cancelled {
            continue;
        }

        // Cleanup session if still alive
        {
            let mut pm = pty_manager.write().await;
            let _ = pm.kill(&pty_session_id);
        }

        // -------------------------------------------------------------------
        // Phase: Quality gates
        // -------------------------------------------------------------------

        let gate_config = load_quality_gate_config(db, project_id).unwrap_or_default();
        let gate_results = run_quality_gates(&gate_config, project_path).await;

        for r in &gate_results {
            let _ = event_tx
                .send(LoopEvent::GateResult {
                    story_id: story.id.clone(),
                    gate: r.name.clone(),
                    passed: r.passed,
                    output: r.output.clone(),
                })
                .await;
        }

        let gates_passed = all_gates_passed(&gate_results);

        // Optional arbiter judgement
        let arbiter_passed = if gate_config.arbiter_judge {
            match arbiter_cli_command(db) {
                Ok((cli_command, model)) => {
                    let gate_triples: Vec<(String, bool, String)> = gate_results
                        .iter()
                        .map(|r| (r.name.clone(), r.passed, r.output.clone()))
                        .collect();

                    let action = ArbiterAction::JudgeCompletion {
                        story: story.clone(),
                        test_output: gate_triples
                            .iter()
                            .map(|(n, p, o)| format!("[{}] {}: {}", if *p { "PASS" } else { "FAIL" }, n, o))
                            .collect::<Vec<_>>()
                            .join("\n"),
                        gate_results: gate_triples,
                    };

                    match dispatch::dispatch(action, project_path, &cli_command, model.as_deref()).await {
                        Ok(resp) => {
                            if let Some(reasoning) = &resp.reasoning {
                                let _ = event_tx
                                    .send(LoopEvent::ReasoningEntry {
                                        action: "JudgeCompletion".to_string(),
                                        reasoning: reasoning.clone(),
                                    })
                                    .await;
                            }
                            resp.passed.unwrap_or(false)
                        }
                        Err(e) => {
                            tracing::error!("[loop_engine] arbiter judge error: {}", e);
                            false
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("[loop_engine] arbiter_cli_command failed: {e}; skipping judge");
                    true // treat as passed when settings unavailable
                }
            }
        } else {
            true // no arbiter judgement required — gate results are sufficient
        };

        let story_passed = gates_passed && arbiter_passed;

        // -------------------------------------------------------------------
        // Phase: Story result
        // -------------------------------------------------------------------

        if story_passed {
            if let Ok(conn) = lock_db(db) {
                let _ = stories::update_story_status(&conn, &story.id, "completed");
                let _ = arbiter_state::set_current_story(&conn, project_id, None);
            }

            let _ = event_tx
                .send(LoopEvent::StoryCompleted { story_id: story.id.clone() })
                .await;

            // Trigger memory extraction for the completed story
            let _ = memory_worker_tx
                .send(MemoryWorkerEvent::ConsolidateProject {
                    project_id: project_id.to_string(),
                    project_path: project_path.to_string(),
                })
                .await;

            consecutive_no_commit = 0;
        } else {
            if let Ok(conn) = lock_db(db) {
                let _ = stories::increment_story_attempts(&conn, &story.id);
            }

            let reason = if !gates_passed {
                "Quality gates failed".to_string()
            } else {
                "Arbiter judged story incomplete".to_string()
            };

            let _ = event_tx
                .send(LoopEvent::StoryFailed {
                    story_id: story.id.clone(),
                    reason,
                })
                .await;

            consecutive_no_commit += 1;
        }

        // -------------------------------------------------------------------
        // Phase: Loop bookkeeping
        // -------------------------------------------------------------------

        if let Ok(conn) = lock_db(db) {
            let _ = arbiter_state::increment_iteration(&conn, project_id);
            let _ = arbiter_state::update_last_activity(&conn, project_id);
        }

        let updated_state = load_or_init_state(db, project_id).unwrap_or(ArbiterStateRow {
            project_id: project_id.to_string(),
            trust_level: TrustLevel::Autonomous,
            loop_status: "running".to_string(),
            current_story_id: None,
            iteration_count: 0,
            max_iterations: 10,
            last_activity_at: None,
        });
        let _ = event_tx
            .send(LoopEvent::IterationCompleted {
                count: updated_state.iteration_count,
                max: updated_state.max_iterations,
            })
            .await;

        // Check whether all stories are now complete
        let all_done = match lock_db(db) {
            Ok(conn) => stories::all_stories_complete(&conn, project_id).unwrap_or(false),
            Err(e) => {
                tracing::error!("[loop_engine] all_stories_complete check failed: {e}");
                false
            }
        };

        if all_done {
            let _ = event_tx.send(LoopEvent::LoopCompleted).await;
            set_status_best_effort(db, event_tx, project_id, "completed").await;
            return;
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: shared Pause/Cancel handling inside the agent-wait select arms
// ---------------------------------------------------------------------------

/// Handles a LoopCommand received while waiting for the agent to finish.
/// Returns `true` if the story was cancelled/paused-then-resumed-as-skip
/// (meaning the outer loop should `continue` to the next story),
/// or `false` if execution should fall through to quality gates.
///
/// Note: this function takes ownership of the cmd Option because it comes
/// directly out of `cmd_rx.recv()`.
async fn handle_agent_wait_cmd(
    cmd: Option<LoopCommand>,
    db: &DbPool,
    event_tx: &mpsc::Sender<LoopEvent>,
    pty_manager: &Arc<RwLock<PtyManager>>,
    session_id: &str,
    project_id: &str,
    cmd_rx: &mut mpsc::Receiver<LoopCommand>,
) -> bool {
    match cmd {
        Some(LoopCommand::Pause) => {
            set_status_best_effort(db, event_tx, project_id, "paused").await;
            // Kill the agent session
            {
                let mut pm = pty_manager.write().await;
                let _ = pm.kill(session_id);
            }
            // Wait for resume/cancel
            loop {
                match cmd_rx.recv().await {
                    Some(LoopCommand::Resume) => {
                        set_status_best_effort(db, event_tx, project_id, "running").await;
                        return true; // re-run story from top of loop
                    }
                    Some(LoopCommand::Cancel) | None => {
                        set_status_best_effort(db, event_tx, project_id, "idle").await;
                        // Signal full exit via a dedicated sentinel — we cannot `return`
                        // from run_loop_lifecycle here, so we use a special path.
                        // The caller checks: if handle_agent_wait_cmd returns true it
                        // `continue`s; the session was already killed and status is idle.
                        // We need to actually exit the lifecycle, so we park indefinitely
                        // on a channel that will never receive — the outer task will be
                        // dropped when the cmd_rx sender is closed.
                        loop {
                            match cmd_rx.recv().await {
                                None => return true,
                                Some(LoopCommand::Cancel) => return true,
                                _ => {}
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        Some(LoopCommand::Cancel) | None => {
            set_status_best_effort(db, event_tx, project_id, "idle").await;
            {
                let mut pm = pty_manager.write().await;
                let _ = pm.kill(session_id);
            }
            // Park until the channel closes; outer loop will exit when cmd_rx closes.
            loop {
                match cmd_rx.recv().await {
                    None => return true,
                    Some(LoopCommand::Cancel) => return true,
                    _ => {}
                }
            }
        }
        _ => false,
    }
}
