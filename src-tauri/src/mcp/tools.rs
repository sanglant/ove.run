use crate::db::init::DbPool;
use serde_json::Value;

// ── Project path → project_id resolution ─────────────────────────────────

pub fn resolve_project_id(db: &DbPool, project_path: &str) -> Option<String> {
    let conn = db.lock().ok()?;
    conn.query_row(
        "SELECT id FROM projects WHERE path = ?1",
        rusqlite::params![project_path],
        |row| row.get(0),
    )
    .ok()
}

// ── Tool handlers ─────────────────────────────────────────────────────────

pub fn handle_list_context(db: &DbPool, project_path: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    let units = crate::db::context::list_context_units(&conn, Some(&project_id))
        .unwrap_or_default();
    let items: Vec<Value> = units
        .iter()
        .filter(|u| !u.is_bundled)
        .map(|u| {
            serde_json::json!({
                "id": u.id,
                "name": u.name,
                "type": u.unit_type,
                "l0_summary": u.l0_summary
            })
        })
        .collect();
    serde_json::json!(items)
}

pub fn handle_get_context(db: &DbPool, project_path: &str, id: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    match crate::db::context::get_context_unit(&conn, id) {
        Ok(u) => {
            if u.project_id.as_deref() != Some(&project_id) && u.project_id.is_some() {
                return serde_json::json!({"error": "context unit not found"});
            }
            serde_json::json!({
                "id": u.id,
                "name": u.name,
                "type": u.unit_type,
                "l1_overview": u.l1_overview,
                "l2_content": u.l2_content
            })
        }
        Err(_) => serde_json::json!({"error": "context unit not found"}),
    }
}

pub fn handle_search_context(db: &DbPool, project_path: &str, query: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    let units =
        crate::db::context::search_context_units(&conn, query, Some(&project_id))
            .unwrap_or_default();
    let items: Vec<Value> = units
        .iter()
        .map(|u| {
            serde_json::json!({
                "id": u.id,
                "name": u.name,
                "type": u.unit_type,
                "l0_summary": u.l0_summary
            })
        })
        .collect();
    serde_json::json!(items)
}

pub fn handle_list_memories(db: &DbPool, project_path: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    let memories =
        crate::db::memory::list_memories(&conn, &project_id, None, Some("project"))
            .unwrap_or_default();
    let items: Vec<Value> = memories
        .iter()
        .map(|m| {
            serde_json::json!({
                "id": m.id,
                "content": m.content,
                "summary": m.summary,
                "importance": m.importance,
                "topics": m.topics_json
            })
        })
        .collect();
    serde_json::json!(items)
}

pub fn handle_search_memories(db: &DbPool, project_path: &str, query: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    let memories =
        crate::db::memory::search_memories(&conn, query, &project_id, None, 10)
            .unwrap_or_default();
    let items: Vec<Value> = memories
        .iter()
        .map(|m| {
            serde_json::json!({
                "id": m.id,
                "content": m.content,
                "summary": m.summary,
                "importance": m.importance,
                "topics": m.topics_json
            })
        })
        .collect();
    serde_json::json!(items)
}

pub fn handle_list_notes(db: &DbPool, project_path: &str) -> Value {
    let project_id = match resolve_project_id(db, project_path) {
        Some(id) => id,
        None => return serde_json::json!({"error": "project not found"}),
    };
    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return serde_json::json!({"error": "db unavailable"}),
    };
    let notes = crate::db::notes::list_notes(&conn, &project_id).unwrap_or_default();
    let items: Vec<Value> = notes
        .iter()
        .filter(|n| n.include_in_context)
        .map(|n| {
            serde_json::json!({
                "id": n.id,
                "title": n.title,
                "content": n.content
            })
        })
        .collect();
    serde_json::json!(items)
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    /// Build an in-memory DbPool with the full production schema + all migrations applied.
    fn make_test_db() -> DbPool {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        crate::db::init::create_tables(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn insert_project(db: &DbPool, id: &str, path: &str) {
        let conn = db.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, path, git_enabled, arbiter_enabled, created_at) \
             VALUES (?1, ?2, ?3, 0, 0, '2024-01-01T00:00:00Z')",
            rusqlite::params![id, "Test Project", path],
        )
        .unwrap();
    }

    fn insert_context_unit(
        db: &DbPool,
        id: &str,
        project_id: Option<&str>,
        name: &str,
        is_bundled: i32,
        l1_overview: Option<&str>,
        l2_content: Option<&str>,
    ) {
        let conn = db.lock().unwrap();
        let rid: i64 = conn
            .execute(
                "INSERT INTO context_units \
                 (id, project_id, name, type, scope, tags_json, l0_summary, l1_overview, \
                  l2_content, is_bundled, bundled_slug, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, 'document', 'project', '[]', 'summary text', ?4, ?5, ?6, \
                         NULL, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')",
                rusqlite::params![id, project_id, name, l1_overview, l2_content, is_bundled],
            )
            .unwrap() as i64;
        // Sync FTS so search_context_units can find the row
        let actual_rid: i64 = conn
            .query_row(
                "SELECT rid FROM context_units WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap();
        conn.execute(
            "INSERT INTO context_units_fts(rowid, name, l0_summary, l1_overview, l2_content) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![actual_rid, name, "summary text", l1_overview, l2_content],
        )
        .unwrap();
        let _ = rid; // suppress unused warning
    }

    fn insert_memory(db: &DbPool, id: &str, project_id: &str, visibility: &str, content: &str) {
        let conn = db.lock().unwrap();
        conn.execute(
            "INSERT INTO memories \
             (id, project_id, session_id, visibility, content, summary, entities_json, \
              topics_json, importance, consolidated, created_at) \
             VALUES (?1, ?2, NULL, ?3, ?4, 'mem summary', '[]', '[]', 0.8, 0, \
                     '2024-01-01T00:00:00Z')",
            rusqlite::params![id, project_id, visibility, content],
        )
        .unwrap();
        let rid: i64 = conn
            .query_row(
                "SELECT rid FROM memories WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap();
        conn.execute(
            "INSERT INTO memories_fts(rowid, content, summary) VALUES (?1, ?2, ?3)",
            rusqlite::params![rid, content, "mem summary"],
        )
        .unwrap();
    }

    fn insert_note(
        db: &DbPool,
        id: &str,
        project_id: &str,
        title: &str,
        content: &str,
        include_in_context: i32,
    ) {
        let conn = db.lock().unwrap();
        conn.execute(
            "INSERT INTO notes (id, project_id, title, content, include_in_context, \
             created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')",
            rusqlite::params![id, project_id, title, content, include_in_context],
        )
        .unwrap();
    }

    // ── resolve_project_id ────────────────────────────────────────────────

    #[test]
    fn resolve_project_id_returns_none_for_unknown_path() {
        let db = make_test_db();
        let result = resolve_project_id(&db, "/nonexistent/path");
        assert!(result.is_none());
    }

    #[test]
    fn resolve_project_id_returns_id_for_known_path() {
        let db = make_test_db();
        insert_project(&db, "proj-1", "/my/project");
        let result = resolve_project_id(&db, "/my/project");
        assert_eq!(result, Some("proj-1".to_string()));
    }

    // ── handle_list_context ───────────────────────────────────────────────

    #[test]
    fn list_context_returns_error_for_unknown_project() {
        let db = make_test_db();
        let result = handle_list_context(&db, "/nonexistent");
        assert_eq!(result["error"], "project not found");
    }

    #[test]
    fn list_context_returns_units_for_known_project() {
        let db = make_test_db();
        insert_project(&db, "proj-2", "/proj/two");
        insert_context_unit(
            &db,
            "unit-1",
            Some("proj-2"),
            "My Unit",
            0,
            None,
            None,
        );

        let result = handle_list_context(&db, "/proj/two");
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["id"], "unit-1");
        assert_eq!(arr[0]["name"], "My Unit");
    }

    #[test]
    fn list_context_excludes_bundled_units() {
        let db = make_test_db();
        insert_project(&db, "proj-3", "/proj/three");
        // Non-bundled unit (should be included)
        insert_context_unit(
            &db,
            "unit-visible",
            Some("proj-3"),
            "Visible Unit",
            0,
            None,
            None,
        );
        // Bundled global unit (should be excluded)
        insert_context_unit(
            &db,
            "unit-bundled",
            None,
            "Bundled Global",
            1,
            None,
            None,
        );

        let result = handle_list_context(&db, "/proj/three");
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["id"], "unit-visible");
    }

    // ── handle_get_context ────────────────────────────────────────────────

    #[test]
    fn get_context_returns_l1_and_l2() {
        let db = make_test_db();
        insert_project(&db, "proj-4", "/proj/four");
        insert_context_unit(
            &db,
            "unit-detail",
            Some("proj-4"),
            "Detail Unit",
            0,
            Some("overview text"),
            Some("full content here"),
        );

        let result = handle_get_context(&db, "/proj/four", "unit-detail");
        assert_eq!(result["id"], "unit-detail");
        assert_eq!(result["l1_overview"], "overview text");
        assert_eq!(result["l2_content"], "full content here");
    }

    #[test]
    fn get_context_rejects_cross_project_access() {
        let db = make_test_db();
        insert_project(&db, "proj-a", "/proj/a");
        insert_project(&db, "proj-b", "/proj/b");
        insert_context_unit(&db, "unit-b", Some("proj-b"), "B Unit", 0, None, None);

        // proj-a should NOT be able to read proj-b's unit
        let result = handle_get_context(&db, "/proj/a", "unit-b");
        assert!(result["error"].is_string(), "expected error for cross-project access");
    }

    #[test]
    fn get_context_allows_global_units() {
        let db = make_test_db();
        insert_project(&db, "proj-c", "/proj/c");
        // Global unit has project_id = None
        insert_context_unit(&db, "unit-global", None, "Global Unit", 0, Some("global overview"), None);

        let result = handle_get_context(&db, "/proj/c", "unit-global");
        assert_eq!(result["id"], "unit-global");
        assert_eq!(result["l1_overview"], "global overview");
    }

    // ── handle_list_memories ──────────────────────────────────────────────

    #[test]
    fn list_memories_returns_project_visibility_only() {
        let db = make_test_db();
        insert_project(&db, "proj-5", "/proj/five");
        insert_memory(&db, "mem-private", "proj-5", "private", "private content");
        insert_memory(&db, "mem-project", "proj-5", "project", "project content");

        let result = handle_list_memories(&db, "/proj/five");
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["id"], "mem-project");
        assert_eq!(arr[0]["content"], "project content");
    }

    // ── handle_list_notes ─────────────────────────────────────────────────

    #[test]
    fn list_notes_returns_only_context_flagged_notes() {
        let db = make_test_db();
        insert_project(&db, "proj-6", "/proj/six");
        insert_note(&db, "note-included", "proj-6", "Included", "content yes", 1);
        insert_note(&db, "note-excluded", "proj-6", "Excluded", "content no", 0);

        let result = handle_list_notes(&db, "/proj/six");
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["id"], "note-included");
        assert_eq!(arr[0]["title"], "Included");
    }
}
