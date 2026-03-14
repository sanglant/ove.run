use crate::state::{TrustLevel, ArbiterStateRow, Story};

pub enum CircuitBreakerAction {
    Continue,
    Pause(String),
    Stop(String),
}

pub fn check_circuit_breakers(
    arbiter_state: &ArbiterStateRow,
    current_story: &Story,
    consecutive_no_commit: i32,
) -> CircuitBreakerAction {
    let max_retries = match arbiter_state.trust_level {
        TrustLevel::Autonomous => 3,
        TrustLevel::FullAuto => 5,
        _ => 1,
    };

    if current_story.iteration_attempts >= max_retries {
        return CircuitBreakerAction::Pause(
            format!("Story '{}' failed {} times", current_story.title, current_story.iteration_attempts)
        );
    }

    if consecutive_no_commit >= 3 {
        return CircuitBreakerAction::Pause(
            "No commit in 3 consecutive iterations".to_string()
        );
    }

    if arbiter_state.iteration_count >= arbiter_state.max_iterations {
        return CircuitBreakerAction::Stop(
            format!("Max iterations ({}) reached", arbiter_state.max_iterations)
        );
    }

    CircuitBreakerAction::Continue
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{ArbiterStateRow, Story, TrustLevel};

    fn make_state(trust: TrustLevel, iterations: i32, max: i32) -> ArbiterStateRow {
        ArbiterStateRow {
            project_id: "p1".to_string(),
            trust_level: trust,
            loop_status: "running".to_string(),
            current_story_id: Some("s1".to_string()),
            iteration_count: iterations,
            max_iterations: max,
            last_activity_at: None,
        }
    }

    fn make_story(attempts: i32) -> Story {
        Story {
            id: "s1".to_string(),
            project_id: "p1".to_string(),
            title: "Test story".to_string(),
            description: "desc".to_string(),
            acceptance_criteria: None,
            priority: 0,
            status: "in_progress".to_string(),
            depends_on_json: "[]".to_string(),
            iteration_attempts: attempts,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn continues_when_under_all_limits() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_supervised_after_1_retry() {
        let state = make_state(TrustLevel::Supervised, 0, 10);
        let story = make_story(1);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn pauses_autonomous_after_3_retries() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(3);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn allows_autonomous_2_retries() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(2);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_fullauto_after_5_retries() {
        let state = make_state(TrustLevel::FullAuto, 0, 10);
        let story = make_story(5);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn allows_fullauto_4_retries() {
        let state = make_state(TrustLevel::FullAuto, 0, 10);
        let story = make_story(4);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Continue));
    }

    #[test]
    fn pauses_on_3_consecutive_no_commit() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 3), CircuitBreakerAction::Pause(_)));
    }

    #[test]
    fn continues_on_2_consecutive_no_commit() {
        let state = make_state(TrustLevel::Autonomous, 0, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 2), CircuitBreakerAction::Continue));
    }

    #[test]
    fn stops_when_max_iterations_reached() {
        let state = make_state(TrustLevel::Autonomous, 10, 10);
        let story = make_story(0);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Stop(_)));
    }

    #[test]
    fn retries_checked_before_max_iterations() {
        let state = make_state(TrustLevel::Autonomous, 10, 10);
        let story = make_story(3);
        assert!(matches!(check_circuit_breakers(&state, &story, 0), CircuitBreakerAction::Pause(_)));
    }
}
