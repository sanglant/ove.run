# Bundled Content: Read-Only with Fork-to-Customize — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bundled personas/skills read-only, silently updated on app upgrades, with a "Duplicate" button for user customization. Add database reset to settings.

**Architecture:** Add `is_bundled` and `bundled_slug` columns to `context_units` via migration. Rewrite the seed system to upsert by slug on version bump. Frontend hides edit/delete on bundled items, shows "Duplicate" instead. Settings gets a "Reset database" button.

**Tech Stack:** Rust (rusqlite, migrations), TypeScript (React, Mantine, Zustand)

---

## Chunk 1: Schema Migration & Seed Rewrite

### Task 1: Add `is_bundled` and `bundled_slug` columns via migration

**Files:**
- Modify: `src-tauri/src/db/init.rs`

- [ ] **Step 1: Add migration 2 to MIGRATIONS array**

Add after the existing migration 1 entry in the `MIGRATIONS` array:

```rust
Migration {
    version: 2,
    description: "add is_bundled and bundled_slug columns to context_units",
    sql: "ALTER TABLE context_units ADD COLUMN is_bundled INTEGER NOT NULL DEFAULT 0;\
          ALTER TABLE context_units ADD COLUMN bundled_slug TEXT;",
},
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 3: Run existing tests**

Run: `cd src-tauri && cargo test db::init`
Expected: all 3 tests pass. The `in_memory_db()` helper uses `SCHEMA` which doesn't include the new columns yet (they're added via migration), but the migration tests should still pass since `run_migrations` processes them.

Note: SQLite doesn't support multiple ALTER TABLE statements in one `execute_batch`. If tests fail, split migration 2 into two separate migrations (2 and 3).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/init.rs
git commit -m "feat: add is_bundled and bundled_slug columns via migration"
```

---

### Task 2: Add `slug` field to BundledUnit and all entries

**Files:**
- Modify: `src-tauri/src/bundled/personas.rs`
- Modify: `src-tauri/src/bundled/skills.rs`

- [ ] **Step 1: Add `slug` field to `BundledUnit` struct**

In `personas.rs`, update the struct:

```rust
pub struct BundledUnit {
    pub slug: &'static str,
    pub name: &'static str,
    pub unit_type: &'static str,
    pub l0_summary: &'static str,
    pub l1_overview: &'static str,
    pub l2_content: &'static str,
}
```

- [ ] **Step 2: Add slug to all 12 persona entries**

Add `slug` as the first field of each BundledUnit in `BUNDLED_PERSONAS`:

| Name | Slug |
|------|------|
| Backend Developer | `"backend-developer"` |
| Frontend Developer | `"frontend-developer"` |
| Full Stack Developer | `"full-stack-developer"` |
| Security Auditor | `"security-auditor"` |
| Code Reviewer | `"code-reviewer"` |
| DevOps Engineer | `"devops-engineer"` |
| Database Architect | `"database-architect"` |
| Technical Writer | `"technical-writer"` |
| Test Engineer | `"test-engineer"` |
| Performance Engineer | `"performance-engineer"` |
| API Designer | `"api-designer"` |
| UI/UX Developer | `"uiux-developer"` |

- [ ] **Step 3: Add slug to all 8 skill entries in `skills.rs`**

| Name | Slug |
|------|------|
| Code Review Guidelines | `"code-review-guidelines"` |
| Testing Best Practices | `"testing-best-practices"` |
| Git Workflow | `"git-workflow"` |
| Error Handling Patterns | `"error-handling-patterns"` |
| Performance Optimization | `"performance-optimization"` |
| Security Checklist | `"security-checklist"` |
| API Design | `"api-design"` |
| Documentation Standards | `"documentation-standards"` |

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compilation error in `seed.rs` because `insert_bundled_unit` doesn't use `slug` yet. That's OK — we fix it in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/bundled/personas.rs src-tauri/src/bundled/skills.rs
git commit -m "feat: add slug field to all bundled personas and skills"
```

---

### Task 3: Rewrite seed system to sync by slug

**Files:**
- Modify: `src-tauri/src/bundled/seed.rs`
- Modify: `src-tauri/src/db/context.rs` (add upsert function)

- [ ] **Step 1: Add `upsert_bundled_unit` to `src-tauri/src/db/context.rs`**

Add at the end of the file (before any `#[cfg(test)]` block):

```rust
/// Upsert a bundled context unit by its slug.
/// If a unit with the same bundled_slug exists, update its content.
/// If not, insert a new one.
pub fn upsert_bundled_unit(conn: &Connection, unit: &ContextUnit, slug: &str) -> Result<(), rusqlite::Error> {
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM context_units WHERE bundled_slug = ?1",
            params![slug],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(id) = existing_id {
        // Update existing bundled unit content (preserving its id)
        conn.execute(
            "UPDATE context_units SET name = ?1, type = ?2, l0_summary = ?3, l1_overview = ?4, \
             l2_content = ?5, is_bundled = 1, updated_at = ?6 WHERE id = ?7",
            params![
                unit.name,
                unit.unit_type,
                unit.l0_summary,
                unit.l1_overview,
                unit.l2_content,
                unit.updated_at,
                id,
            ],
        )?;
    } else {
        // Insert new bundled unit
        conn.execute(
            "INSERT INTO context_units (id, project_id, name, type, scope, tags_json, l0_summary, \
             l1_overview, l2_content, is_bundled, bundled_slug, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?11, ?12)",
            params![
                unit.id,
                unit.project_id,
                unit.name,
                unit.unit_type,
                unit.scope,
                unit.tags_json,
                unit.l0_summary,
                unit.l1_overview,
                unit.l2_content,
                slug,
                unit.created_at,
                unit.updated_at,
            ],
        )?;
        sync_fts_insert(conn, unit)?;
    }
    Ok(())
}
```

Add `use rusqlite::OptionalExtension;` at the top of `context.rs` if not already present.

- [ ] **Step 2: Rewrite `src-tauri/src/bundled/seed.rs`**

Replace the entire file:

```rust
use rusqlite::Connection;
use crate::db::context;
use crate::db::settings;
use crate::state::ContextUnit;
use super::personas::BUNDLED_PERSONAS;
use super::skills::BUNDLED_SKILLS;
use super::personas::BundledUnit;

const SEED_VERSION_KEY: &str = "bundled_seed_version";
const CURRENT_SEED_VERSION: &str = "2";

/// Sync bundled content with the database.
/// On version mismatch: upserts all bundled units by slug (insert new, update existing).
/// Bundled units removed from code (slug no longer present) are left in DB but marked non-bundled.
pub fn sync_bundled_content(conn: &Connection) -> Result<(), String> {
    let current = settings::get_setting(conn, SEED_VERSION_KEY)
        .map_err(|e| e.to_string())?;

    if current.as_deref() == Some(CURRENT_SEED_VERSION) {
        return Ok(());
    }

    // Collect all current slugs for cleanup
    let mut active_slugs: Vec<&str> = Vec::new();

    for bundled in BUNDLED_PERSONAS {
        upsert_bundled(conn, bundled)?;
        active_slugs.push(bundled.slug);
    }

    for bundled in BUNDLED_SKILLS {
        upsert_bundled(conn, bundled)?;
        active_slugs.push(bundled.slug);
    }

    // Mark removed bundled units as non-bundled (user-owned)
    let placeholders: Vec<String> = active_slugs.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    if !placeholders.is_empty() {
        let sql = format!(
            "UPDATE context_units SET is_bundled = 0 WHERE is_bundled = 1 AND bundled_slug NOT IN ({})",
            placeholders.join(", ")
        );
        let params: Vec<&dyn rusqlite::types::ToSql> = active_slugs.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
    }

    settings::set_setting(conn, SEED_VERSION_KEY, CURRENT_SEED_VERSION)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn upsert_bundled(conn: &Connection, bundled: &BundledUnit) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let unit = ContextUnit {
        id: uuid::Uuid::new_v4().to_string(),
        project_id: None,
        name: bundled.name.to_string(),
        unit_type: bundled.unit_type.to_string(),
        scope: "global".to_string(),
        tags_json: "[]".to_string(),
        l0_summary: Some(bundled.l0_summary.to_string()),
        l1_overview: Some(bundled.l1_overview.to_string()),
        l2_content: Some(bundled.l2_content.to_string()),
        created_at: now.clone(),
        updated_at: now,
    };
    context::upsert_bundled_unit(conn, &unit, bundled.slug)
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Update `src-tauri/src/lib.rs` call site**

Find `crate::bundled::seed::seed_bundled_content` and rename to `crate::bundled::seed::sync_bundled_content`.

- [ ] **Step 4: Add migration 3 to set is_bundled and slug on existing rows**

In `src-tauri/src/db/init.rs`, add a migration that retroactively marks existing bundled units. Since we know their exact names, match by name:

```rust
Migration {
    version: 3,
    description: "mark existing bundled content with is_bundled flag and slugs",
    sql: "\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'backend-developer' WHERE name = 'Backend Developer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'frontend-developer' WHERE name = 'Frontend Developer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'full-stack-developer' WHERE name = 'Full Stack Developer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'security-auditor' WHERE name = 'Security Auditor' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'code-reviewer' WHERE name = 'Code Reviewer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'devops-engineer' WHERE name = 'DevOps Engineer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'database-architect' WHERE name = 'Database Architect' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'technical-writer' WHERE name = 'Technical Writer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'test-engineer' WHERE name = 'Test Engineer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'performance-engineer' WHERE name = 'Performance Engineer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'api-designer' WHERE name = 'API Designer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'uiux-developer' WHERE name = 'UI/UX Developer' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'code-review-guidelines' WHERE name = 'Code Review Guidelines' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'testing-best-practices' WHERE name = 'Testing Best Practices' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'git-workflow' WHERE name = 'Git Workflow' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'error-handling-patterns' WHERE name = 'Error Handling Patterns' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'performance-optimization' WHERE name = 'Performance Optimization' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'security-checklist' WHERE name = 'Security Checklist' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'api-design' WHERE name = 'API Design' AND scope = 'global' AND project_id IS NULL;\
        UPDATE context_units SET is_bundled = 1, bundled_slug = 'documentation-standards' WHERE name = 'Documentation Standards' AND scope = 'global' AND project_id IS NULL;\
    ",
},
```

Note: SQLite supports multiple UPDATE statements in `execute_batch`. This is safe.

- [ ] **Step 5: Verify it compiles and tests pass**

Run: `cd src-tauri && cargo check && cargo test`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/bundled/seed.rs src-tauri/src/db/context.rs src-tauri/src/db/init.rs src-tauri/src/lib.rs
git commit -m "feat: rewrite seed system to sync bundled content by slug"
```

---

### Task 4: Update `ContextUnit` Rust struct and TypeScript type

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add fields to Rust struct**

In `src-tauri/src/state.rs`, add to the `ContextUnit` struct:

```rust
#[serde(default)]
pub is_bundled: bool,
pub bundled_slug: Option<String>,
```

- [ ] **Step 2: Add fields to TypeScript type**

In `src/types/index.ts`, add to the `ContextUnit` interface:

```typescript
is_bundled: boolean;
bundled_slug: string | null;
```

- [ ] **Step 3: Update `row_to_context_unit` in `src-tauri/src/db/context.rs`**

The `row_to_context_unit` function needs to read the new columns. Find it and add:

```rust
is_bundled: row.get::<_, i32>("is_bundled").unwrap_or(0) != 0,
bundled_slug: row.get("bundled_slug").ok(),
```

- [ ] **Step 4: Update `create_context_unit` in `src-tauri/src/db/context.rs`**

The INSERT statement needs the new columns. Add `is_bundled` and `bundled_slug` to the column list and params. For non-bundled units created via the UI, `is_bundled` is `false` and `bundled_slug` is `None`.

- [ ] **Step 5: Verify everything compiles**

Run: `cd src-tauri && cargo check && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/db/context.rs src/types/index.ts
git commit -m "feat: add is_bundled and bundled_slug to ContextUnit type"
```

---

## Chunk 2: Frontend UI Changes

### Task 5: Update ContextUnitCard for bundled items

**Files:**
- Modify: `src/features/context/components/ContextUnitCard.tsx`

- [ ] **Step 1: Add `onDuplicate` prop and "Built-in" badge**

Update the `ContextUnitCardProps` interface — add:

```typescript
onDuplicate?: (unit: ContextUnit) => void;
```

- [ ] **Step 2: Show "Built-in" badge for bundled items**

After the scope badge (line ~64), add conditionally:

```tsx
{unit.is_bundled && (
  <Badge
    size="xs"
    color="gray"
    variant="filled"
    styles={{ root: { textTransform: "none" } }}
  >
    Built-in
  </Badge>
)}
```

- [ ] **Step 3: Replace Edit with Duplicate for bundled items**

Replace the edit ActionIcon (lines ~108-118) with a conditional:

```tsx
{unit.is_bundled ? (
  <Tooltip label="Duplicate to customize" position="top" withArrow>
    <ActionIcon
      variant="subtle"
      size="sm"
      onClick={() => onDuplicate?.(unit)}
      aria-label={`Duplicate ${unit.name}`}
      styles={{ root: { color: "var(--text-secondary)" } }}
    >
      <Copy size={13} />
    </ActionIcon>
  </Tooltip>
) : (
  <Tooltip label="Edit" position="top" withArrow>
    <ActionIcon
      variant="subtle"
      size="sm"
      onClick={() => onEdit(unit)}
      aria-label={`Edit ${unit.name}`}
      styles={{ root: { color: "var(--text-secondary)" } }}
    >
      <Pencil size={13} />
    </ActionIcon>
  </Tooltip>
)}
```

Import `Copy` from `lucide-react`.

- [ ] **Step 4: Hide Delete for bundled items**

Wrap the delete ActionIcon (lines ~119-131) with:

```tsx
{!unit.is_bundled && !isGlobalDefault && (
  // existing delete ActionIcon
)}
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src/features/context/components/ContextUnitCard.tsx
git commit -m "feat: show Built-in badge, Duplicate button for bundled context units"
```

---

### Task 6: Add duplicate handler to ContextPanel

**Files:**
- Modify: `src/features/context/components/ContextPanel.tsx`
- Modify: `src/stores/contextStore.ts`

- [ ] **Step 1: Add `duplicateUnit` action to contextStore**

In `src/stores/contextStore.ts`, add a `duplicateUnit` action that:
1. Creates a new ContextUnit with a fresh UUID
2. Sets `name` to `"Custom — {original.name}"`
3. Copies all content fields (l0, l1, l2, tags, type, scope)
4. Sets `is_bundled: false`, `bundled_slug: null`
5. Calls `createContextUnit` via tauri IPC
6. Reloads the units list

- [ ] **Step 2: Add `handleDuplicate` handler in ContextPanel**

In `ContextPanel.tsx`, add:

```typescript
const handleDuplicate = async (unit: ContextUnit) => {
  await duplicateUnit(unit);
};
```

Where `duplicateUnit` comes from `useContextStore`.

- [ ] **Step 3: Pass `onDuplicate` to ContextUnitCard**

In the card rendering, add `onDuplicate={handleDuplicate}` prop.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add src/features/context/components/ContextPanel.tsx src/stores/contextStore.ts
git commit -m "feat: add duplicate handler for bundled context units"
```

---

### Task 7: Add database reset to Settings

**Files:**
- Modify: `src/features/settings/components/SettingsModal.tsx`
- Modify: `src-tauri/src/commands/settings_commands.rs`
- Modify: `src-tauri/src/lib.rs` (register command)
- Modify: `src/lib/tauri.ts` (add IPC wrapper)

- [ ] **Step 1: Add `reset_database` command to Rust backend**

In `src-tauri/src/commands/settings_commands.rs`, add:

```rust
#[tauri::command]
pub async fn reset_database(app: tauri::AppHandle) -> Result<(), AppError> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| AppError::Other(e.to_string()))?;
    let db_path = crate::db::init::db_path(&app_data_dir);
    // Delete the database file
    if db_path.exists() {
        std::fs::remove_file(&db_path).map_err(|e| AppError::Io(e))?;
    }
    // Restart the app
    app.restart();
    Ok(())
}
```

Add `use tauri::Manager;` if not already imported.

- [ ] **Step 2: Register the command in `src-tauri/src/lib.rs`**

Add `reset_database` to the `generate_handler![]` macro and the import from `commands::settings_commands`.

- [ ] **Step 3: Add IPC wrapper in `src/lib/tauri.ts`**

```typescript
export async function resetDatabase(): Promise<void> {
  return invoke("reset_database");
}
```

- [ ] **Step 4: Add reset button to SettingsModal**

In `src/features/settings/components/SettingsModal.tsx`, add a "Data" section at the bottom of the modal body:

```tsx
<Divider my="md" color="var(--border)" />
<Text size="sm" fw={600} c="var(--text-primary)" mb="xs">Data</Text>
<Button
  variant="outline"
  color="red"
  size="xs"
  onClick={() => {
    if (window.confirm("This will delete all projects, sessions, memories, and context. The app will restart with a fresh database. This cannot be undone.")) {
      resetDatabase();
    }
  }}
>
  Reset database
</Button>
```

Import `resetDatabase` from `@/lib/tauri` and `Divider` from `@mantine/core`.

- [ ] **Step 5: Verify everything compiles**

Run: `cd src-tauri && cargo check && cd .. && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/settings_commands.rs src-tauri/src/lib.rs src/lib/tauri.ts src/features/settings/components/SettingsModal.tsx
git commit -m "feat: add database reset button to settings"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd src-tauri && cargo test`
Expected: all tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `pnpm test`
Expected: all tests pass

- [ ] **Step 3: Build everything**

Run: `pnpm build && cd src-tauri && cargo build`
Expected: clean build

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve any build/test issues"
```
