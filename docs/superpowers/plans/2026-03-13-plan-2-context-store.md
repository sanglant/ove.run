# Plan 2: Context Store & Notes System

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Unified Context Store (System 1) — the single system that manages personas, skills, knowledge, and references with L0/L1/L2 tiered loading, plus the updated notes system with context toggle.

**Architecture:** Context units stored in SQLite `context_units` table with FTS5 search. Arbiter generates L0/L1 summaries via existing CLI call path. Context assignment system links units to sessions and projects. Bundled personas/skills ship as embedded content.

**Tech Stack:** Rust (rusqlite), TypeScript/React (Mantine), Tauri IPC

**Spec:** `docs/superpowers/specs/2026-03-13-arbiter-extensions-design.md` — Sections 2 and 2.5

---

**What Plan 1 built:**
- All "guardian" references renamed to "arbiter" across the full stack
- SQLite database (`ove.db`) with all tables from the spec schema
- All JSON file storage replaced with SQLite (projects, settings, sessions, notes, bug configs)
- `DbPool` (Arc<Mutex<Connection>>) added to AppState
- Stub modules: `db/context.rs`, `db/memory.rs`, `db/arbiter_state.rs`, `db/stories.rs`
- Knowledge panel stubbed out (placeholder)
- Old knowledge module deleted
- `Note` struct has `include_in_context` field, `setNoteContextToggle` IPC command exists

**What this plan builds:**
- Full CRUD for `context_units` table (db/context.rs)
- FTS5 sync triggers for context_units_fts
- Tauri IPC commands for context operations
- TypeScript types and IPC bridge for context system
- L0/L1 summary generation via Arbiter CLI calls
- Context assignment system (session + project defaults)
- Bundled personas and skills (embedded in binary)
- Context panel UI replacing the old Knowledge panel
- Notes panel with working context toggle

**What the next plan needs:**
- `db/context.rs` fully operational with all CRUD + FTS5 search
- Context units can be queried by project, type, scope
- L0 summaries exist for searching/scanning
- The Arbiter can call `arbiter_review` to generate summaries (this path already exists)

---

## File Structure

### New Files
- `src-tauri/src/commands/context_commands.rs` — Tauri IPC commands for context operations
- `src-tauri/src/bundled/mod.rs` — module for bundled content
- `src-tauri/src/bundled/personas.rs` — embedded persona definitions
- `src-tauri/src/bundled/skills.rs` — embedded skill definitions
- `src/features/context/components/ContextPanel.tsx` — main context panel (replaces KnowledgePanel)
- `src/features/context/components/ContextUnitEditor.tsx` — create/edit context unit form
- `src/features/context/components/ContextUnitCard.tsx` — card displaying a context unit with L0/L1/L2 tiers
- `src/features/context/components/ContextAssignments.tsx` — assign/unassign context to sessions
- `src/stores/contextStore.ts` — Zustand store for context units

### Modified Files
- `src-tauri/src/db/context.rs` — implement full CRUD (currently a stub)
- `src-tauri/src/commands/mod.rs` — add context_commands
- `src-tauri/src/lib.rs` — register new commands, add bundled module, seed bundled content on first run
- `src/types/index.ts` — add ContextUnit, ContextAssignment types
- `src/lib/tauri.ts` — add context IPC functions
- `src/lib/arbiter.ts` — add summary generation function
- `src/features/notes/components/NotesPanel.tsx` — ensure context toggle works end-to-end

### Deleted Files
- `src/features/knowledge/components/KnowledgePanel.tsx` — replaced by ContextPanel
- `src/features/knowledge/components/KnowledgeEditor.tsx` — replaced by ContextUnitEditor

---

## Chunk 1: Context Store Backend

### Task 1: Implement context_units CRUD in db/context.rs

**Files:**
- Modify: `src-tauri/src/db/context.rs`

- [ ] **Step 1: Implement core CRUD functions**

```rust
use rusqlite::{Connection, params};
use crate::state::ContextUnit;

pub fn list_context_units(conn: &Connection, project_id: Option<&str>) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    // If project_id is Some, return project-scoped + global units
    // If project_id is None, return only global units
}

pub fn get_context_unit(conn: &Connection, id: &str) -> Result<ContextUnit, rusqlite::Error> {
    // SELECT by id
}

pub fn create_context_unit(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    // INSERT into context_units + sync FTS5
}

pub fn update_context_unit(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    // UPDATE by id + sync FTS5
}

pub fn delete_context_unit(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    // DELETE by id + sync FTS5 + cascade delete from context_assignments and context_defaults
}

pub fn search_context_units(conn: &Connection, query: &str, project_id: Option<&str>) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    // FTS5 search against context_units_fts
}

pub fn list_l0_summaries(conn: &Connection, project_id: &str) -> Result<Vec<(String, String, String)>, rusqlite::Error> {
    // Returns (id, name, l0_summary) for all units accessible to this project
    // Used by Arbiter to scan what's relevant
}
```

- [ ] **Step 2: Implement FTS5 sync helpers**

```rust
fn sync_fts_insert(conn: &Connection, unit: &ContextUnit) -> Result<(), rusqlite::Error> {
    // Get the rid from context_units where id = unit.id
    // INSERT INTO context_units_fts(rowid, name, l0_summary, l1_overview, l2_content) VALUES (rid, ...)
}

fn sync_fts_delete(conn: &Connection, rid: i64) -> Result<(), rusqlite::Error> {
    // INSERT INTO context_units_fts(context_units_fts, rowid, name, l0_summary, l1_overview, l2_content) VALUES('delete', rid, ...)
}
```

- [ ] **Step 3: Implement context assignment functions**

```rust
pub fn assign_context_to_session(conn: &Connection, unit_id: &str, session_id: &str) -> Result<(), rusqlite::Error> {
    // INSERT OR IGNORE into context_assignments
}

pub fn unassign_context_from_session(conn: &Connection, unit_id: &str, session_id: &str) -> Result<(), rusqlite::Error> {
    // DELETE from context_assignments
}

pub fn list_session_context(conn: &Connection, session_id: &str) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    // JOIN context_assignments with context_units
}

pub fn set_project_default(conn: &Connection, unit_id: &str, project_id: &str) -> Result<(), rusqlite::Error> {
    // INSERT OR IGNORE into context_defaults
}

pub fn remove_project_default(conn: &Connection, unit_id: &str, project_id: &str) -> Result<(), rusqlite::Error> {
    // DELETE from context_defaults
}

pub fn list_project_defaults(conn: &Connection, project_id: &str) -> Result<Vec<ContextUnit>, rusqlite::Error> {
    // JOIN context_defaults with context_units
}

pub fn copy_defaults_to_session(conn: &Connection, project_id: &str, session_id: &str) -> Result<(), rusqlite::Error> {
    // INSERT INTO context_assignments SELECT from context_defaults WHERE project_id = ?
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/context.rs
git commit -m "feat: implement context_units CRUD with FTS5 and assignment system"
```

### Task 2: Add ContextUnit to Rust types

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add ContextUnit struct**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextUnit {
    pub id: String,
    pub project_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub unit_type: String,       // persona, skill, knowledge, reference
    pub scope: String,            // global, project
    pub tags_json: String,
    pub l0_summary: Option<String>,
    pub l1_overview: Option<String>,
    pub l2_content: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add ContextUnit struct to Rust types"
```

### Task 3: Create context Tauri commands

**Files:**
- Create: `src-tauri/src/commands/context_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create context_commands.rs**

Implement Tauri commands wrapping each db function:
```rust
#[tauri::command]
pub async fn list_context_units(state: tauri::State<'_, AppState>, project_id: Option<String>) -> Result<Vec<ContextUnit>, String>

#[tauri::command]
pub async fn create_context_unit(state: tauri::State<'_, AppState>, unit: ContextUnit) -> Result<(), String>

#[tauri::command]
pub async fn update_context_unit(state: tauri::State<'_, AppState>, unit: ContextUnit) -> Result<(), String>

#[tauri::command]
pub async fn delete_context_unit(state: tauri::State<'_, AppState>, id: String) -> Result<(), String>

#[tauri::command]
pub async fn search_context_units(state: tauri::State<'_, AppState>, query: String, project_id: Option<String>) -> Result<Vec<ContextUnit>, String>

#[tauri::command]
pub async fn assign_context(state: tauri::State<'_, AppState>, unit_id: String, session_id: String) -> Result<(), String>

#[tauri::command]
pub async fn unassign_context(state: tauri::State<'_, AppState>, unit_id: String, session_id: String) -> Result<(), String>

#[tauri::command]
pub async fn list_session_context(state: tauri::State<'_, AppState>, session_id: String) -> Result<Vec<ContextUnit>, String>

#[tauri::command]
pub async fn set_project_default_context(state: tauri::State<'_, AppState>, unit_id: String, project_id: String) -> Result<(), String>

#[tauri::command]
pub async fn remove_project_default_context(state: tauri::State<'_, AppState>, unit_id: String, project_id: String) -> Result<(), String>

#[tauri::command]
pub async fn list_project_default_context(state: tauri::State<'_, AppState>, project_id: String) -> Result<Vec<ContextUnit>, String>
```

- [ ] **Step 2: Register in mod.rs and lib.rs**

Add `pub mod context_commands;` to `commands/mod.rs`.
Add all new commands to the `generate_handler!` macro in `lib.rs`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/context_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri IPC commands for context store"
```

### Task 4: Implement L0/L1 summary generation

**Files:**
- Modify: `src-tauri/src/commands/context_commands.rs`

- [ ] **Step 1: Add generate_summary command**

This command calls the existing `arbiter_review` CLI path with a summary generation prompt:

```rust
#[tauri::command]
pub async fn generate_context_summary(
    state: tauri::State<'_, AppState>,
    unit_id: String,
    project_path: String,
) -> Result<(), String> {
    // 1. Read the context unit's l2_content
    // 2. Build a prompt: "Generate a one-line L0 summary and a structured L1 overview..."
    // 3. Call arbiter_review with the prompt
    // 4. Parse the response for L0_SUMMARY: and L1_OVERVIEW: sections
    // 5. Update the context unit with the generated summaries
}
```

The prompt template:
```
Given the following content for a context unit named "{name}" of type "{type}":

{l2_content}

Generate two summaries:
L0_SUMMARY: A single sentence (max 100 tokens) describing what this content is about.
L1_OVERVIEW: A structured overview (max 2000 tokens) covering key points, usage, and relevance.
```

- [ ] **Step 2: Register command**

Add to `generate_handler!` in `lib.rs`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/context_commands.rs src-tauri/src/lib.rs
git commit -m "feat: add L0/L1 summary generation via Arbiter CLI"
```

---

## Chunk 2: Bundled Content

### Task 5: Create bundled personas module

**Files:**
- Create: `src-tauri/src/bundled/mod.rs`
- Create: `src-tauri/src/bundled/personas.rs`

- [ ] **Step 1: Create bundled module**

Create `src-tauri/src/bundled/mod.rs`:
```rust
pub mod personas;
pub mod skills;
pub mod seed;
```

- [ ] **Step 2: Define bundled personas**

Create `src-tauri/src/bundled/personas.rs` with 10-15 persona definitions as static data. Each persona is a struct with name, l0_summary, l1_overview, l2_content.

Curate from agency-agents (Apache 2.0). Key personas:
- Backend Developer
- Frontend Developer
- Full Stack Developer
- Security Auditor
- Code Reviewer
- DevOps Engineer
- Database Architect
- Technical Writer
- Test Engineer
- Performance Engineer
- API Designer
- UI/UX Developer

Each persona's L2 content is a markdown document (~500-1000 words) describing the role, approach, key skills, and what to focus on.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/bundled/
git commit -m "feat: add bundled persona definitions"
```

### Task 6: Create bundled skills module

**Files:**
- Create: `src-tauri/src/bundled/skills.rs`

- [ ] **Step 1: Define bundled skills**

Create `src-tauri/src/bundled/skills.rs` with 5-10 skill definitions. Key skills:
- Code Review Guidelines
- Design System Principles (adapted from Impeccable, Apache 2.0)
- Testing Best Practices
- Git Workflow
- Error Handling Patterns
- Performance Optimization
- Security Checklist
- API Design

Each skill's L2 content is a markdown document with actionable guidance.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/bundled/skills.rs
git commit -m "feat: add bundled skill definitions"
```

### Task 7: Implement database seeding

**Files:**
- Create: `src-tauri/src/bundled/seed.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create seed function**

Create `src-tauri/src/bundled/seed.rs`:
```rust
use rusqlite::Connection;
use crate::db::context;
use crate::state::ContextUnit;
use super::personas::BUNDLED_PERSONAS;
use super::skills::BUNDLED_SKILLS;

pub fn seed_bundled_content(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Check if bundled content already exists (by checking for a marker setting)
    // If not, insert all personas and skills as global context_units
    // Set a marker setting to prevent re-seeding
}
```

- [ ] **Step 2: Call seed on app startup**

In `lib.rs`, after `init_db`:
```rust
{
    let conn = db.lock().unwrap();
    crate::bundled::seed::seed_bundled_content(&conn).ok();
}
```

Add `mod bundled;` to module declarations.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/bundled/seed.rs src-tauri/src/lib.rs
git commit -m "feat: seed bundled personas and skills on first run"
```

---

## Chunk 3: Frontend — Context Store UI

### Task 8: Add TypeScript types for context system

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add context types**

```typescript
export type ContextUnitType = "persona" | "skill" | "knowledge" | "reference";
export type ContextScope = "global" | "project";

export interface ContextUnit {
  id: string;
  project_id: string | null;
  name: string;
  type: ContextUnitType;
  scope: ContextScope;
  tags_json: string;
  l0_summary: string | null;
  l1_overview: string | null;
  l2_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContextAssignment {
  context_unit_id: string;
  session_id: string;
  assigned_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ContextUnit TypeScript types"
```

### Task 9: Add context IPC functions

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add context IPC wrappers**

```typescript
export async function listContextUnits(projectId?: string): Promise<ContextUnit[]> {
  return invoke("list_context_units", { projectId });
}
export async function createContextUnit(unit: ContextUnit): Promise<void> {
  return invoke("create_context_unit", { unit });
}
export async function updateContextUnit(unit: ContextUnit): Promise<void> {
  return invoke("update_context_unit", { unit });
}
export async function deleteContextUnit(id: string): Promise<void> {
  return invoke("delete_context_unit", { id });
}
export async function searchContextUnits(query: string, projectId?: string): Promise<ContextUnit[]> {
  return invoke("search_context_units", { query, projectId });
}
export async function assignContext(unitId: string, sessionId: string): Promise<void> {
  return invoke("assign_context", { unitId, sessionId });
}
export async function unassignContext(unitId: string, sessionId: string): Promise<void> {
  return invoke("unassign_context", { unitId, sessionId });
}
export async function listSessionContext(sessionId: string): Promise<ContextUnit[]> {
  return invoke("list_session_context", { sessionId });
}
export async function setProjectDefaultContext(unitId: string, projectId: string): Promise<void> {
  return invoke("set_project_default_context", { unitId, projectId });
}
export async function removeProjectDefaultContext(unitId: string, projectId: string): Promise<void> {
  return invoke("remove_project_default_context", { unitId, projectId });
}
export async function listProjectDefaultContext(projectId: string): Promise<ContextUnit[]> {
  return invoke("list_project_default_context", { projectId });
}
export async function generateContextSummary(unitId: string, projectPath: string): Promise<void> {
  return invoke("generate_context_summary", { unitId, projectPath });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add context store IPC functions"
```

### Task 10: Create context Zustand store

**Files:**
- Create: `src/stores/contextStore.ts`

- [ ] **Step 1: Implement context store**

```typescript
import { create } from "zustand";
import type { ContextUnit, ContextUnitType } from "@/types";
import { listContextUnits, createContextUnit, updateContextUnit, deleteContextUnit, searchContextUnits } from "@/lib/tauri";

interface ContextState {
  units: ContextUnit[];
  loading: boolean;
  filter: ContextUnitType | "all";
  setFilter: (filter: ContextUnitType | "all") => void;
  loadUnits: (projectId?: string) => Promise<void>;
  addUnit: (unit: ContextUnit) => Promise<void>;
  editUnit: (unit: ContextUnit) => Promise<void>;
  removeUnit: (id: string) => Promise<void>;
  searchUnits: (query: string, projectId?: string) => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/contextStore.ts
git commit -m "feat: add context store Zustand state management"
```

### Task 11: Build ContextPanel component

**Files:**
- Create: `src/features/context/components/ContextPanel.tsx`
- Create: `src/features/context/components/ContextUnitCard.tsx`
- Create: `src/features/context/components/ContextUnitEditor.tsx`
- Create: `src/features/context/components/ContextAssignments.tsx`
- Delete: `src/features/knowledge/components/KnowledgePanel.tsx`
- Delete: `src/features/knowledge/components/KnowledgeEditor.tsx`

- [ ] **Step 1: Build ContextUnitCard**

Displays a single context unit with:
- Name and type badge (Persona/Skill/Knowledge/Reference)
- L0 summary (always visible)
- Expandable L1 overview
- Expandable L2 full content
- Edit/delete actions
- "Generate summary" button if L0 is missing
- "Set as project default" toggle

- [ ] **Step 2: Build ContextUnitEditor**

Modal form for creating/editing a context unit:
- Name input
- Type selector (dropdown: persona/skill/knowledge/reference)
- Scope selector (global/project)
- Tags input
- L2 content editor (markdown)
- L0/L1 are auto-generated but editable

- [ ] **Step 3: Build ContextAssignments**

Panel showing which context units are assigned to the current session:
- List of assigned units with unassign button
- Dropdown/search to assign new units
- "Apply project defaults" button

- [ ] **Step 4: Build ContextPanel**

Main panel replacing the Knowledge panel:
- Type filter tabs: All | Personas | Skills | Knowledge | References
- Search bar (FTS5 search)
- List of ContextUnitCard components
- "Add context unit" button
- Integrates ContextAssignments when a session is active

- [ ] **Step 5: Delete old knowledge components**

Remove `src/features/knowledge/` directory entirely.

- [ ] **Step 6: Update parent layout**

Replace the Knowledge panel tab/route with Context panel in the sidebar or panel switcher component.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: build Context panel UI replacing Knowledge panel"
```

### Task 12: Update Notes panel with context toggle

**Files:**
- Modify: `src/features/notes/components/NotesPanel.tsx`

- [ ] **Step 1: Add context toggle**

For each note in the list, add a Mantine Switch component:
```tsx
<Switch
  label="Include in agent context"
  checked={note.include_in_context}
  onChange={(e) => handleContextToggle(note.id, e.currentTarget.checked)}
/>
```

The handler calls `setNoteContextToggle` from the IPC bridge.

- [ ] **Step 2: Commit**

```bash
git add src/features/notes/components/NotesPanel.tsx
git commit -m "feat: add include-in-context toggle to notes panel"
```

### Task 13: Build verification

- [ ] **Step 1: Verify Rust builds**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 2: Verify TypeScript builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Builds without errors

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues in context store implementation"
```

---

## Verification Checklist

- [ ] Context units can be created, listed, updated, deleted via the UI
- [ ] Bundled personas and skills appear on first launch
- [ ] FTS5 search works (type a keyword, relevant units appear)
- [ ] Context units can be assigned to sessions
- [ ] Project defaults can be set and are copied to new sessions
- [ ] L0/L1 summaries can be generated via the "Generate summary" button
- [ ] Notes "include in context" toggle persists correctly
- [ ] Old Knowledge panel is fully replaced
- [ ] `cargo build` and `npm run build` both succeed
