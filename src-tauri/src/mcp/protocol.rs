use serde::{Deserialize, Serialize};
use serde_json::Value;

// ── JSON-RPC 2.0 wire types ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct McpRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct McpResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<McpError>,
}

#[derive(Debug, Serialize)]
pub struct McpError {
    pub code: i32,
    pub message: String,
}

impl McpResponse {
    pub fn ok(id: Option<Value>, result: Value) -> Self {
        Self { jsonrpc: "2.0".into(), id, result: Some(result), error: None }
    }

    pub fn err(id: Option<Value>, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(McpError { code, message: message.into() }),
        }
    }
}

// ── MCP tool schema types ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

pub fn all_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_context".into(),
            description: "List all context units (knowledge) for the project with their L0 one-sentence summaries. Use this to discover available context before calling get_context.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string", "description": "Absolute path to the project root" }
                },
                "required": ["project_path"]
            }),
        },
        ToolDefinition {
            name: "get_context".into(),
            description: "Get the full L1 overview and L2 content for a specific context unit by ID.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string" },
                    "id": { "type": "string", "description": "Context unit ID from list_context" }
                },
                "required": ["project_path", "id"]
            }),
        },
        ToolDefinition {
            name: "search_context".into(),
            description: "Full-text search across context unit names, summaries, and content.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string" },
                    "query": { "type": "string", "description": "Search terms" }
                },
                "required": ["project_path", "query"]
            }),
        },
        ToolDefinition {
            name: "list_memories".into(),
            description: "List project-level memories ordered by importance. Memories are automatically extracted facts and patterns from past agent sessions.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string" }
                },
                "required": ["project_path"]
            }),
        },
        ToolDefinition {
            name: "search_memories".into(),
            description: "Full-text search across project memories. Returns top 10 by relevance and importance.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string" },
                    "query": { "type": "string" }
                },
                "required": ["project_path", "query"]
            }),
        },
        ToolDefinition {
            name: "list_notes".into(),
            description: "List notes that have been marked for agent context inclusion.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string" }
                },
                "required": ["project_path"]
            }),
        },
        ToolDefinition {
            name: "check_in".into(),
            description: "Call this before starting work on a task. Returns relevant project context, memories, and any pending instructions. You MUST call this tool at the start of each task to get the latest project context. Read session_id from the OVE_SESSION_ID environment variable and project_path from OVE_PROJECT_PATH.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string", "description": "Absolute path to the project root (read from OVE_PROJECT_PATH env var)" },
                    "session_id": { "type": "string", "description": "PTY session ID (read from OVE_SESSION_ID env var)" },
                    "task_summary": { "type": "string", "description": "Brief description of what you're about to work on" },
                    "status": { "type": "string", "enum": ["starting", "working", "blocked"], "description": "Current status" }
                },
                "required": ["project_path", "session_id", "task_summary", "status"]
            }),
        },
        ToolDefinition {
            name: "request_guidance".into(),
            description: "Call when you need a decision from the user, encounter an ambiguity, or want to confirm an approach before proceeding. This will pause and wait for the user's response. Read session_id from OVE_SESSION_ID and project_path from OVE_PROJECT_PATH.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string", "description": "Absolute path to the project root" },
                    "session_id": { "type": "string", "description": "PTY session ID" },
                    "question": { "type": "string", "description": "What you need decided or clarified" },
                    "options": { "type": "array", "items": { "type": "string" }, "description": "Possible choices (optional)" },
                    "allow_free_input": { "type": "boolean", "description": "Whether free text input is allowed (default true)" }
                },
                "required": ["project_path", "session_id", "question"]
            }),
        },
        ToolDefinition {
            name: "report_completion".into(),
            description: "Call when you have completed the assigned task. Provides a summary of what was done. This triggers quality gate checks (build, lint, test) and returns results so you can fix issues before finishing. Read session_id from OVE_SESSION_ID and project_path from OVE_PROJECT_PATH.".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_path": { "type": "string", "description": "Absolute path to the project root" },
                    "session_id": { "type": "string", "description": "PTY session ID" },
                    "summary": { "type": "string", "description": "Summary of what was accomplished" },
                    "files_changed": { "type": "array", "items": { "type": "string" }, "description": "List of files modified (optional)" },
                    "confidence": { "type": "string", "enum": ["high", "medium", "low"], "description": "Confidence level (optional)" }
                },
                "required": ["project_path", "session_id", "summary"]
            }),
        },
    ]
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_response_ok_serializes_without_error_field() {
        let r = McpResponse::ok(Some(serde_json::json!(1)), serde_json::json!({"x": 1}));
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"result\""));
        assert!(!s.contains("\"error\""));
    }

    #[test]
    fn mcp_response_err_serializes_without_result_field() {
        let r = McpResponse::err(Some(serde_json::json!(1)), -32601, "not found");
        let s = serde_json::to_string(&r).unwrap();
        assert!(!s.contains("\"result\""));
        assert!(s.contains("\"error\""));
        assert!(s.contains("-32601"));
    }

    #[test]
    fn mcp_request_deserializes_from_json() {
        let json = r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":null}"#;
        let req: McpRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.method, "tools/list");
    }

    #[test]
    fn all_tool_definitions_returns_nine_tools() {
        assert_eq!(all_tool_definitions().len(), 9);
    }

    #[test]
    fn tool_definitions_have_required_fields() {
        for tool in all_tool_definitions() {
            assert!(!tool.name.is_empty());
            assert!(!tool.description.is_empty());
            let required = tool.input_schema["required"].as_array().unwrap();
            assert!(required.iter().any(|v| v.as_str() == Some("project_path")));
        }
    }
}
