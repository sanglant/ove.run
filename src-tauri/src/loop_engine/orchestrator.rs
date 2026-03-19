use crate::state::Story;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionGroup {
    pub story_ids: Vec<String>,
    pub pattern: ExecutionPattern,
}

#[derive(Debug, Clone, Serialize)]
pub enum ExecutionPattern {
    Sequential,
    Parallel,
}

/// Analyze stories and build an execution plan respecting dependencies.
/// Groups independent stories for potential parallel execution.
pub fn plan_execution(stories: &[Story]) -> Vec<ExecutionGroup> {
    if stories.is_empty() {
        return Vec::new();
    }

    let pending: Vec<&Story> = stories.iter().filter(|s| s.status == "pending").collect();

    if pending.is_empty() {
        return Vec::new();
    }

    // Seed completed_ids with already-finished stories
    let mut completed_ids: std::collections::HashSet<String> = stories
        .iter()
        .filter(|s| s.status == "completed" || s.status == "skipped")
        .map(|s| s.id.clone())
        .collect();

    let mut groups: Vec<ExecutionGroup> = Vec::new();
    let mut remaining: Vec<&Story> = pending;

    while !remaining.is_empty() {
        // Partition into ready (all deps satisfied) and blocked
        let (ready, blocked): (Vec<&Story>, Vec<&Story>) = remaining.into_iter().partition(|s| {
            let deps: Vec<String> = serde_json::from_str(&s.depends_on_json).unwrap_or_default();
            deps.iter().all(|d| completed_ids.contains(d))
        });

        if ready.is_empty() {
            // Deadlock — remaining stories have unsatisfiable dependencies.
            // Surface them as a sequential group so the caller can handle the failure.
            groups.push(ExecutionGroup {
                story_ids: blocked.iter().map(|s| s.id.clone()).collect(),
                pattern: ExecutionPattern::Sequential,
            });
            break;
        }

        let pattern = if ready.len() > 1 {
            ExecutionPattern::Parallel
        } else {
            ExecutionPattern::Sequential
        };

        let ids: Vec<String> = ready.iter().map(|s| s.id.clone()).collect();

        // Mark these as "virtually completed" so subsequent waves can depend on them
        for id in &ids {
            completed_ids.insert(id.clone());
        }

        groups.push(ExecutionGroup {
            story_ids: ids,
            pattern,
        });

        remaining = blocked;
    }

    groups
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_story(id: &str, status: &str, deps: &[&str]) -> Story {
        Story {
            id: id.to_string(),
            project_id: "proj".to_string(),
            title: id.to_string(),
            description: String::new(),
            acceptance_criteria: None,
            priority: 0,
            status: status.to_string(),
            depends_on_json: serde_json::to_string(
                &deps.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            )
            .unwrap(),
            iteration_attempts: 0,
            created_at: String::new(),
        }
    }

    #[test]
    fn empty_stories_returns_empty_plan() {
        assert!(plan_execution(&[]).is_empty());
    }

    #[test]
    fn all_independent_stories_become_one_parallel_group() {
        let stories = vec![
            make_story("a", "pending", &[]),
            make_story("b", "pending", &[]),
            make_story("c", "pending", &[]),
        ];
        let plan = plan_execution(&stories);
        assert_eq!(plan.len(), 1);
        assert!(matches!(plan[0].pattern, ExecutionPattern::Parallel));
        assert_eq!(plan[0].story_ids.len(), 3);
    }

    #[test]
    fn linear_chain_produces_sequential_groups() {
        let stories = vec![
            make_story("a", "pending", &[]),
            make_story("b", "pending", &["a"]),
            make_story("c", "pending", &["b"]),
        ];
        let plan = plan_execution(&stories);
        assert_eq!(plan.len(), 3);
        for group in &plan {
            assert!(matches!(group.pattern, ExecutionPattern::Sequential));
            assert_eq!(group.story_ids.len(), 1);
        }
        assert_eq!(plan[0].story_ids[0], "a");
        assert_eq!(plan[1].story_ids[0], "b");
        assert_eq!(plan[2].story_ids[0], "c");
    }

    #[test]
    fn already_completed_deps_allow_immediate_execution() {
        let stories = vec![
            make_story("a", "completed", &[]),
            make_story("b", "pending", &["a"]),
        ];
        let plan = plan_execution(&stories);
        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].story_ids[0], "b");
    }

    #[test]
    fn deadlock_group_surfaced_as_sequential() {
        // "b" depends on "c", "c" depends on "b" — neither will ever be in completed_ids
        let stories = vec![
            make_story("b", "pending", &["c"]),
            make_story("c", "pending", &["b"]),
        ];
        let plan = plan_execution(&stories);
        assert_eq!(plan.len(), 1);
        assert!(matches!(plan[0].pattern, ExecutionPattern::Sequential));
        assert_eq!(plan[0].story_ids.len(), 2);
    }
}
