use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
use serde_json::json;
#[cfg(test)]
use serde_json::Value;
use std::sync::Arc;

use crate::db::init::DbPool;
use crate::mcp::protocol::{all_tool_definitions, McpRequest, McpResponse};
use crate::mcp::tools;

// ── App state for the axum router ─────────────────────────────────────────

#[derive(Clone)]
struct McpState {
    db: DbPool,
}

// ── Single POST /mcp endpoint ─────────────────────────────────────────────

async fn mcp_handler(
    State(state): State<Arc<McpState>>,
    Json(req): Json<McpRequest>,
) -> (StatusCode, Json<McpResponse>) {
    let response = dispatch_request(&state.db, req);
    (StatusCode::OK, Json(response))
}

fn dispatch_request(db: &DbPool, req: McpRequest) -> McpResponse {
    match req.method.as_str() {
        "initialize" => McpResponse::ok(
            req.id,
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "ove-run", "version": "1.0.0" }
            }),
        ),
        "tools/list" => McpResponse::ok(
            req.id,
            json!({ "tools": all_tool_definitions() }),
        ),
        "tools/call" => {
            let params = req.params.unwrap_or(json!({}));
            let name = params["name"].as_str().unwrap_or("").to_string();
            let args = &params["arguments"];

            let project_path = args["project_path"].as_str().unwrap_or("");
            if project_path.is_empty() {
                return McpResponse::err(req.id, -32602, "project_path required");
            }

            let result = match name.as_str() {
                "list_context" => tools::handle_list_context(db, project_path),
                "get_context" => {
                    let id = args["id"].as_str().unwrap_or("");
                    if id.is_empty() {
                        return McpResponse::err(req.id, -32602, "id required");
                    }
                    tools::handle_get_context(db, project_path, id)
                }
                "search_context" => {
                    let query = args["query"].as_str().unwrap_or("");
                    if query.is_empty() {
                        return McpResponse::err(req.id, -32602, "query required");
                    }
                    tools::handle_search_context(db, project_path, query)
                }
                "list_memories" => tools::handle_list_memories(db, project_path),
                "search_memories" => {
                    let query = args["query"].as_str().unwrap_or("");
                    if query.is_empty() {
                        return McpResponse::err(req.id, -32602, "query required");
                    }
                    tools::handle_search_memories(db, project_path, query)
                }
                "list_notes" => tools::handle_list_notes(db, project_path),
                _ => return McpResponse::err(req.id, -32601, format!("unknown tool: {}", name)),
            };

            McpResponse::ok(
                req.id,
                json!({
                    "content": [{ "type": "text", "text": result.to_string() }]
                }),
            )
        }
        _ => McpResponse::err(req.id, -32601, format!("method not found: {}", req.method)),
    }
}

// ── Server startup ─────────────────────────────────────────────────────────

/// Starts the MCP HTTP server and returns the bound port.
///
/// Binds synchronously using std::net::TcpListener so the port is available
/// immediately without needing an async context. The serve loop is spawned
/// into the existing Tauri/Tokio runtime via tauri::async_runtime::spawn.
/// This avoids calling block_on inside the already-running Tokio runtime,
/// which would panic.
pub fn start_server(db: DbPool) -> Result<u16, String> {
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("MCP server bind failed: {e}"))?;
    std_listener
        .set_nonblocking(true)
        .map_err(|e| format!("set_nonblocking failed: {e}"))?;

    let port = std_listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    let state = Arc::new(McpState { db });
    let app = Router::new()
        .route("/mcp", post(mcp_handler))
        .with_state(state);

    tauri::async_runtime::spawn(async move {
        let listener = tokio::net::TcpListener::from_std(std_listener)
            .expect("convert std listener to tokio");
        if let Err(e) = axum::serve(listener, app).await {
            tracing::error!("[mcp] server error: {e}");
        }
    });

    tracing::info!("[mcp] server listening on 127.0.0.1:{}", port);
    Ok(port)
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init::DbPool;
    use std::sync::{Arc, Mutex};

    fn make_empty_db() -> DbPool {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::init::create_tables(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn req(method: &str, params: Option<Value>) -> McpRequest {
        McpRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(1)),
            method: method.into(),
            params,
        }
    }

    #[test]
    fn dispatch_initialize_returns_protocol_version() {
        let db = make_empty_db();
        let resp = dispatch_request(&db, req("initialize", None));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert_eq!(result["protocolVersion"], "2024-11-05");
        assert_eq!(result["serverInfo"]["name"], "ove-run");
    }

    #[test]
    fn dispatch_tools_list_returns_six_tools() {
        let db = make_empty_db();
        let resp = dispatch_request(&db, req("tools/list", None));
        let tools = resp.result.unwrap()["tools"].as_array().unwrap().len();
        assert_eq!(tools, 6);
    }

    #[test]
    fn dispatch_unknown_method_returns_error() {
        let db = make_empty_db();
        let resp = dispatch_request(&db, req("unknown/method", None));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32601);
    }

    #[test]
    fn dispatch_tools_call_missing_project_path_returns_error() {
        let db = make_empty_db();
        let resp = dispatch_request(
            &db,
            req("tools/call", Some(json!({
                "name": "list_context",
                "arguments": {}
            }))),
        );
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32602);
    }

    #[test]
    fn dispatch_tools_call_unknown_tool_returns_error() {
        let db = make_empty_db();
        let resp = dispatch_request(
            &db,
            req("tools/call", Some(json!({
                "name": "does_not_exist",
                "arguments": { "project_path": "/proj" }
            }))),
        );
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32601);
    }

    #[test]
    fn dispatch_tools_call_list_context_wraps_result_in_content() {
        let db = make_empty_db();
        db.lock().unwrap().execute(
            "INSERT INTO projects (id, name, path, created_at, git_enabled, arbiter_enabled) VALUES ('p1', 'P', '/p', '2026-01-01', 0, 0)",
            [],
        ).unwrap();
        let resp = dispatch_request(
            &db,
            req("tools/call", Some(json!({
                "name": "list_context",
                "arguments": { "project_path": "/p" }
            }))),
        );
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert!(result["content"].is_array());
        assert_eq!(result["content"][0]["type"], "text");
    }
}
