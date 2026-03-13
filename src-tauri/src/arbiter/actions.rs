use serde::{Serialize, Deserialize};
use crate::state::{Memory, ContextUnit, Story};

#[derive(Debug)]
pub enum ArbiterAction {
    AnswerQuestion {
        terminal_output: String,
        options: Vec<String>,
        allow_free_input: bool,
        context_units: Vec<ContextUnit>,
        memories: Vec<Memory>,
    },
    DecomposeRequest {
        user_request: String,
        project_context: Vec<ContextUnit>,
        memories: Vec<Memory>,
    },
    SelectNextStory {
        stories: Vec<Story>,
        completed_stories: Vec<Story>,
        memories: Vec<Memory>,
    },
    JudgeCompletion {
        story: Story,
        test_output: String,
        gate_results: Vec<(String, bool, String)>,
    },
    ExtractMemories {
        terminal_output: String,
    },
    ConsolidateMemory {
        memories: Vec<Memory>,
    },
    GenerateSummary {
        name: String,
        unit_type: String,
        l2_content: String,
    },
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ArbiterResponse {
    pub answer: Option<String>,
    pub answer_text: Option<String>,
    pub reasoning: Option<String>,
    pub stories: Option<Vec<StoryDraft>>,
    pub next_story_id: Option<String>,
    pub passed: Option<bool>,
    pub memories: Option<Vec<MemoryDraft>>,
    pub summary: Option<String>,
    pub insight: Option<String>,
    pub l0_summary: Option<String>,
    pub l1_overview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoryDraft {
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
    pub priority: i32,
    pub depends_on: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryDraft {
    pub content: String,
    pub importance: f64,
    pub entities: Vec<String>,
    pub topics: Vec<String>,
    pub visibility: String,
}
