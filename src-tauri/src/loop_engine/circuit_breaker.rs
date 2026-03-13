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
