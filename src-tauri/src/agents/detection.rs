use crate::state::AgentStatus;
use regex::Regex;

pub struct OutputMonitor {
    idle_pattern: Regex,
    input_pattern: Regex,
    finished_pattern: Regex,
    /// Buffer for accumulating partial lines
    line_buffer: String,
    current_status: AgentStatus,
}

impl OutputMonitor {
    pub fn new(
        idle_pattern: &str,
        input_pattern: &str,
        finished_pattern: &str,
    ) -> Result<Self, String> {
        let idle_re =
            Regex::new(idle_pattern).map_err(|e| format!("Invalid idle pattern: {}", e))?;
        let input_re =
            Regex::new(input_pattern).map_err(|e| format!("Invalid input pattern: {}", e))?;
        let finished_re =
            Regex::new(finished_pattern).map_err(|e| format!("Invalid finished pattern: {}", e))?;

        Ok(Self {
            idle_pattern: idle_re,
            input_pattern: input_re,
            finished_pattern: finished_re,
            line_buffer: String::new(),
            current_status: AgentStatus::Starting,
        })
    }

    /// Feed new output data. Returns Some(new_status) if the status changed.
    pub fn feed(&mut self, data: &str) -> Option<AgentStatus> {
        // Strip ANSI escape sequences before matching
        let clean_data = strip_ansi(data);
        self.line_buffer.push_str(&clean_data);

        // Process complete lines
        let mut new_status: Option<AgentStatus> = None;

        // Keep checking the buffer for newlines
        while let Some(pos) = self.line_buffer.find('\n') {
            let line = self.line_buffer[..pos].trim().to_string();
            self.line_buffer = self.line_buffer[pos + 1..].to_string();

            if let Some(status) = self.match_line(&line) {
                new_status = Some(status);
            }
        }

        // Also check the current buffer tail (for prompts without newlines)
        let tail = self.line_buffer.trim().to_string();
        if !tail.is_empty() {
            if let Some(status) = self.match_line(&tail) {
                new_status = Some(status);
            }
        }

        new_status
    }

    fn match_line(&mut self, line: &str) -> Option<AgentStatus> {
        if line.is_empty() {
            return None;
        }

        let new_status = if self.finished_pattern.is_match(line) {
            AgentStatus::Finished
        } else if self.input_pattern.is_match(line) {
            AgentStatus::NeedsInput
        } else if self.idle_pattern.is_match(line) {
            AgentStatus::Idle
        } else {
            AgentStatus::Working
        };

        if new_status != self.current_status {
            self.current_status = new_status.clone();
            Some(new_status)
        } else {
            None
        }
    }

    pub fn current_status(&self) -> &AgentStatus {
        &self.current_status
    }
}

/// Strip ANSI escape sequences from a string
fn strip_ansi(input: &str) -> String {
    let bytes = strip_ansi_escapes::strip(input.as_bytes());
    String::from_utf8_lossy(&bytes).to_string()
}
