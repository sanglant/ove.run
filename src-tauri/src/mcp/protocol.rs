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
    fn all_tool_definitions_returns_six_tools() {
        assert_eq!(all_tool_definitions().len(), 6);
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
