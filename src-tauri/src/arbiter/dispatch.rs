use crate::arbiter::actions::{ArbiterAction, ArbiterResponse, MemoryDraft, StoryDraft};
use crate::arbiter::prompts;
use crate::commands::project_commands::run_arbiter_cli;

pub async fn dispatch(
    action: ArbiterAction,
    project_path: &str,
    cli_command: &str,
    model: Option<&str>,
) -> Result<ArbiterResponse, String> {
    let prompt = build_prompt(&action);
    let raw = run_arbiter_cli(&prompt, project_path, cli_command, model).await?;
    parse_response(&action, &raw)
}

fn build_prompt(action: &ArbiterAction) -> String {
    match action {
        ArbiterAction::AnswerQuestion {
            terminal_output,
            options,
            allow_free_input,
            context_units,
            memories,
        } => {
            let context_section = if context_units.is_empty() {
                String::new()
            } else {
                let lines: Vec<String> = context_units
                    .iter()
                    .map(|u| {
                        let summary = u.l0_summary.as_deref().unwrap_or(&u.name);
                        format!("- {} ({}): {}", u.name, u.unit_type, summary)
                    })
                    .collect();
                format!("## Context\n{}", lines.join("\n"))
            };

            let memory_section = if memories.is_empty() {
                String::new()
            } else {
                let lines: Vec<String> = memories
                    .iter()
                    .map(|m| format!("- {}", m.content))
                    .collect();
                format!("## Relevant Memories\n{}", lines.join("\n"))
            };

            let mut options_lines: Vec<String> = options
                .iter()
                .enumerate()
                .map(|(i, opt)| format!("{}. {}", i + 1, opt))
                .collect();
            if *allow_free_input {
                options_lines.push("Or provide a free-form text answer.".to_string());
            }
            let options_section = options_lines.join("\n");

            prompts::ANSWER_QUESTION
                .replace("{context_section}", &context_section)
                .replace("{memory_section}", &memory_section)
                .replace("{terminal_output}", terminal_output)
                .replace("{options_section}", &options_section)
        }

        ArbiterAction::DecomposeRequest {
            user_request,
            project_context,
            memories,
        } => {
            let context_section = if project_context.is_empty() {
                String::new()
            } else {
                let lines: Vec<String> = project_context
                    .iter()
                    .map(|u| {
                        let summary = u.l0_summary.as_deref().unwrap_or(&u.name);
                        format!("- {} ({}): {}", u.name, u.unit_type, summary)
                    })
                    .collect();
                format!("## Project Context\n{}", lines.join("\n"))
            };

            let memory_section = if memories.is_empty() {
                String::new()
            } else {
                let lines: Vec<String> = memories
                    .iter()
                    .map(|m| format!("- {}", m.content))
                    .collect();
                format!("## Relevant Memories\n{}", lines.join("\n"))
            };

            prompts::DECOMPOSE_REQUEST
                .replace("{user_request}", user_request)
                .replace("{context_section}", &context_section)
                .replace("{memory_section}", &memory_section)
        }

        ArbiterAction::SelectNextStory {
            stories,
            completed_stories,
            memories,
        } => {
            let stories_section = if stories.is_empty() {
                "No pending stories.".to_string()
            } else {
                stories
                    .iter()
                    .map(|s| {
                        format!(
                            "ID: {}\nTitle: {}\nPriority: {}\nDescription: {}\n",
                            s.id, s.title, s.priority, s.description
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n---\n")
            };

            let completed_section = if completed_stories.is_empty() {
                "None.".to_string()
            } else {
                completed_stories
                    .iter()
                    .map(|s| format!("- {} ({})", s.title, s.id))
                    .collect::<Vec<_>>()
                    .join("\n")
            };

            let memory_section = if memories.is_empty() {
                String::new()
            } else {
                let lines: Vec<String> = memories
                    .iter()
                    .map(|m| format!("- {}", m.content))
                    .collect();
                format!("## Relevant Memories\n{}", lines.join("\n"))
            };

            prompts::SELECT_NEXT_STORY
                .replace("{stories_section}", &stories_section)
                .replace("{completed_section}", &completed_section)
                .replace("{memory_section}", &memory_section)
        }

        ArbiterAction::JudgeCompletion {
            story,
            test_output,
            gate_results,
        } => {
            let acceptance = story
                .acceptance_criteria
                .as_deref()
                .unwrap_or("No explicit criteria specified.");

            let gate_results_section = if gate_results.is_empty() {
                "No gate results.".to_string()
            } else {
                gate_results
                    .iter()
                    .map(|(name, passed, detail)| {
                        let status = if *passed { "PASS" } else { "FAIL" };
                        format!("- [{}] {}: {}", status, name, detail)
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            };

            prompts::JUDGE_COMPLETION
                .replace("{story_title}", &story.title)
                .replace("{story_description}", &story.description)
                .replace("{acceptance_criteria}", acceptance)
                .replace("{test_output}", test_output)
                .replace("{gate_results_section}", &gate_results_section)
        }

        ArbiterAction::ExtractMemories { terminal_output } => {
            prompts::EXTRACT_MEMORIES.replace("{terminal_output}", terminal_output)
        }

        ArbiterAction::ConsolidateMemory { memories } => {
            let memories_section = memories
                .iter()
                .map(|m| format!("- [importance: {:.2}] {}", m.importance, m.content))
                .collect::<Vec<_>>()
                .join("\n");

            prompts::CONSOLIDATE_MEMORY.replace("{memories_section}", &memories_section)
        }

        ArbiterAction::GenerateSummary {
            name,
            unit_type,
            l2_content,
        } => prompts::GENERATE_SUMMARY
            .replace("{name}", name)
            .replace("{unit_type}", unit_type)
            .replace("{l2_content}", l2_content),
    }
}

fn parse_response(action: &ArbiterAction, raw: &str) -> Result<ArbiterResponse, String> {
    match action {
        ArbiterAction::AnswerQuestion { .. } => {
            let mut resp = ArbiterResponse::default();
            for line in raw.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("ANSWER:") {
                    resp.answer = Some(val.trim().to_string());
                } else if let Some(val) = trimmed.strip_prefix("ANSWER_TEXT:") {
                    resp.answer_text = Some(val.trim().to_string());
                } else if let Some(val) = trimmed.strip_prefix("REASONING:") {
                    resp.reasoning = Some(val.trim().to_string());
                }
            }
            Ok(resp)
        }

        ArbiterAction::DecomposeRequest { .. } => {
            // Find the JSON array boundaries
            let start = raw
                .find('[')
                .ok_or_else(|| format!("No JSON array found in decompose response: {}", raw))?;
            let end = raw
                .rfind(']')
                .ok_or_else(|| "No closing bracket in decompose response".to_string())?;

            let json_slice = &raw[start..=end];
            let drafts: Vec<StoryDraft> = serde_json::from_str(json_slice)
                .map_err(|e| format!("Failed to parse story drafts: {} — raw: {}", e, json_slice))?;

            Ok(ArbiterResponse {
                stories: Some(drafts),
                ..Default::default()
            })
        }

        ArbiterAction::SelectNextStory { .. } => {
            let mut resp = ArbiterResponse::default();
            for line in raw.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("NEXT_STORY:") {
                    resp.next_story_id = Some(val.trim().to_string());
                } else if let Some(val) = trimmed.strip_prefix("REASONING:") {
                    resp.reasoning = Some(val.trim().to_string());
                }
            }
            Ok(resp)
        }

        ArbiterAction::JudgeCompletion { .. } => {
            let mut resp = ArbiterResponse::default();
            for line in raw.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("PASSED:") {
                    let v = val.trim().to_lowercase();
                    resp.passed = Some(v == "true");
                } else if let Some(val) = trimmed.strip_prefix("REASONING:") {
                    resp.reasoning = Some(val.trim().to_string());
                }
            }
            Ok(resp)
        }

        ArbiterAction::ExtractMemories { .. } => {
            let mut drafts: Vec<MemoryDraft> = Vec::new();

            for line in raw.lines() {
                let trimmed = line.trim();
                let Some(rest) = trimmed.strip_prefix("MEMORY:") else {
                    continue;
                };

                // Format: <content> | importance:<val> | entities:<val> | topics:<val> | visibility:<val>
                let parts: Vec<&str> = rest.splitn(5, '|').collect();
                let content = parts.first().map(|s| s.trim().to_string()).unwrap_or_default();
                if content.is_empty() {
                    continue;
                }

                let mut importance = 0.5_f64;
                let mut entities: Vec<String> = Vec::new();
                let mut topics: Vec<String> = Vec::new();
                let mut visibility = "local".to_string();

                for part in parts.iter().skip(1) {
                    let p = part.trim();
                    if let Some(v) = p.strip_prefix("importance:") {
                        importance = v.trim().parse().unwrap_or(0.5);
                    } else if let Some(v) = p.strip_prefix("entities:") {
                        entities = v
                            .trim()
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    } else if let Some(v) = p.strip_prefix("topics:") {
                        topics = v
                            .trim()
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    } else if let Some(v) = p.strip_prefix("visibility:") {
                        visibility = v.trim().to_string();
                    }
                }

                drafts.push(MemoryDraft {
                    content,
                    importance,
                    entities,
                    topics,
                    visibility,
                });
            }

            Ok(ArbiterResponse {
                memories: Some(drafts),
                ..Default::default()
            })
        }

        ArbiterAction::ConsolidateMemory { .. } => {
            let mut resp = ArbiterResponse::default();
            for line in raw.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("SUMMARY:") {
                    resp.summary = Some(val.trim().to_string());
                } else if let Some(val) = trimmed.strip_prefix("INSIGHT:") {
                    resp.insight = Some(val.trim().to_string());
                }
            }
            Ok(resp)
        }

        ArbiterAction::GenerateSummary { .. } => {
            let mut resp = ArbiterResponse::default();
            for line in raw.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("L0_SUMMARY:") {
                    resp.l0_summary = Some(val.trim().to_string());
                } else if let Some(val) = trimmed.strip_prefix("L1_OVERVIEW:") {
                    resp.l1_overview = Some(val.trim().to_string());
                }
            }
            Ok(resp)
        }
    }
}
