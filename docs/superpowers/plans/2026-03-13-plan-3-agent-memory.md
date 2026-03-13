# Plan 3: Agent Memory System

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Agent Memory system (System 2) — automatic extraction of facts/decisions from agent terminal output, private/public visibility, FTS5 retrieval, background consolidation, and memory decay.

**Architecture:** Memories stored in SQLite `memories` table with FTS5 search. Consolidations stored in `consolidations` table. The Arbiter extracts memories via CLI calls against terminal output. A background consolidation loop synthesizes related memories. Memory decay is calculated at query time using a linear formula.

**Tech Stack:** Rust (rusqlite, tokio), TypeScript/React (Mantine), Tauri IPC + events

**Spec:** `docs/superpowers/specs/2026-03-13-arbiter-extensions-design.md` — Section 3

---

**What Plan 1 built:**
- SQLite database with all tables including `memories`, `consolidations`, and FTS5 virtual tables
- `DbPool` in AppState, all storage goes through SQLite
- `arbiter_review` Tauri command for CLI-based LLM calls

**What Plan 2 built:**
- Full context_units CRUD with FTS5 search
- Context assignment system (session + project defaults)
- L0/L1 summary generation via Arbiter CLI
- Bundled personas and skills
- Context panel UI

**What this plan builds:**
- Full CRUD for `memories` and `consolidations` tables (db/memory.rs)
- FTS5 sync for memories_fts and consolidations_fts
- Memory extraction Tauri command (calls Arbiter CLI with terminal output)
- Memory visibility management (private/public, auto-promotion)
- Memory retrieval with FTS5 + importance/recency scoring
- Background consolidation loop (Rust tokio task)
- Memory decay calculation and pruning
- Memory panel UI (view/search/toggle visibility)
- Integration with Arbiter's AnswerQuestion flow (load relevant memories into prompt)

**What the next plan needs:**
- `db/memory.rs` fully operational with CRUD + FTS5 search + scored retrieval
- Memory extraction callable from Rust (for the loop engine to call after each iteration)
- Consolidation loop running as background task
- Memories retrievable by project + visibility + relevance scoring

---

## File Structure

### New Files
- `src-tauri/src/commands/memory_commands.rs` — Tauri IPC commands for memory operations
- `src-tauri/src/memory_worker.rs` — background consolidation loop
- `src/features/memory/components/MemoryPanel.tsx` — memory browser UI
- `src/features/memory/components/MemoryCard.tsx` — single memory display
- `src/features/memory/components/ConsolidationCard.tsx` — consolidation display
- `src/stores/memoryStore.ts` — Zustand store for memories

### Modified Files
- `src-tauri/src/db/memory.rs` — implement full CRUD (currently a stub)
- `src-tauri/src/state.rs` — add Memory and Consolidation structs
- `src-tauri/src/commands/mod.rs` — add memory_commands
- `src-tauri/src/lib.rs` — register memory commands, start consolidation worker
- `src/types/index.ts` — add Memory, Consolidation types
- `src/lib/tauri.ts` — add memory IPC functions
- `src/lib/arbiter.ts` — integrate memory retrieval into AnswerQuestion flow

---

## Chunk 1: Memory Backend

### Task 1: Add Memory and Consolidation types

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add Memory struct**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: String,
    pub project_id: String,
    pub session_id: Option<String>,
    pub visibility: String,     // "private" or "public"
    pub content: String,
    pub summary: Option<String>,
    pub entities_json: String,
    pub topics_json: String,
    pub importance: f64,
    pub consolidated: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consolidation {
    pub id: String,
    pub project_id: String,
    pub source_ids_json: String,
    pub summary: String,
    pub insight: String,
    pub created_at: String,
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat: add Memory and Consolidation types"
```

### Task 2: Implement memory CRUD in db/memory.rs

**Files:**
- Modify: `src-tauri/src/db/memory.rs`

- [ ] **Step 1: Implement core CRUD**

```rust
pub fn create_memory(conn: &Connection, memory: &Memory) -> Result<(), rusqlite::Error>
pub fn list_memories(conn: &Connection, project_id: &str, session_id: Option<&str>, visibility: Option<&str>) -> Result<Vec<Memory>, rusqlite::Error>
pub fn update_memory_visibility(conn: &Connection, id: &str, visibility: &str) -> Result<(), rusqlite::Error>
pub fn mark_memories_consolidated(conn: &Connection, ids: &[String]) -> Result<(), rusqlite::Error>
pub fn delete_memory(conn: &Connection, id: &str) -> Result<(), rusqlite::Error>
```

- [ ] **Step 2: Implement FTS5 sync**

```rust
fn sync_memory_fts_insert(conn: &Connection, memory: &Memory) -> Result<(), rusqlite::Error>
fn sync_memory_fts_delete(conn: &Connection, rid: i64) -> Result<(), rusqlite::Error>
```

- [ ] **Step 3: Implement scored retrieval**

```rust
/// Search memories with FTS5, score by importance * recency, return top N
pub fn search_memories(
    conn: &Connection,
    query: &str,
    project_id: &str,
    session_id: Option<&str>,  // if Some, include private memories for this session
    limit: usize,
) -> Result<Vec<Memory>, rusqlite::Error> {
    // 1. FTS5 search against memories_fts
    // 2. JOIN with memories table to get full data
    // 3. Filter: project_id matches AND (visibility='public' OR session_id matches)
    // 4. Calculate effective_importance = importance * max(0, 1 - days_since_creation / 90)
    //    (consolidated memories: importance unchanged, no decay)
    // 5. ORDER BY effective_importance DESC
    // 6. LIMIT N
}
```

- [ ] **Step 4: Implement consolidation CRUD**

```rust
pub fn create_consolidation(conn: &Connection, consolidation: &Consolidation) -> Result<(), rusqlite::Error>
pub fn list_consolidations(conn: &Connection, project_id: &str) -> Result<Vec<Consolidation>, rusqlite::Error>
pub fn search_consolidations(conn: &Connection, query: &str, project_id: &str, limit: usize) -> Result<Vec<Consolidation>, rusqlite::Error>
```

With FTS5 sync for consolidations_fts.

- [ ] **Step 5: Implement memory pruning**

```rust
/// Delete unconsolidated memories with effective_importance < 0.05
pub fn prune_decayed_memories(conn: &Connection, project_id: &str) -> Result<usize, rusqlite::Error> {
    // SELECT memories WHERE consolidated=0 AND importance * max(0, 1 - julianday('now') - julianday(created_at)) / 90) < 0.05
    // DELETE those rows + sync FTS5
    // Return count deleted
}
```

- [ ] **Step 6: Implement unconsolidated memory listing for consolidation loop**

```rust
/// Get unconsolidated memories grouped by topic overlap (for consolidation)
pub fn get_unconsolidated_memories(conn: &Connection, project_id: &str, limit: usize) -> Result<Vec<Memory>, rusqlite::Error> {
    // SELECT * FROM memories WHERE project_id=? AND consolidated=0 ORDER BY created_at DESC LIMIT ?
}

pub fn count_unconsolidated(conn: &Connection, project_id: &str) -> Result<usize, rusqlite::Error> {
    // SELECT COUNT(*) FROM memories WHERE project_id=? AND consolidated=0
}
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/db/memory.rs
git commit -m "feat: implement memory CRUD with FTS5, scored retrieval, and consolidation"
```

### Task 3: Create memory Tauri commands

**Files:**
- Create: `src-tauri/src/commands/memory_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create memory_commands.rs**

```rust
#[tauri::command]
pub async fn list_memories(state: ..., project_id: String, session_id: Option<String>) -> Result<Vec<Memory>, String>

#[tauri::command]
pub async fn search_memories(state: ..., query: String, project_id: String, session_id: Option<String>, limit: usize) -> Result<Vec<Memory>, String>

#[tauri::command]
pub async fn toggle_memory_visibility(state: ..., id: String, visibility: String) -> Result<(), String>

#[tauri::command]
pub async fn delete_memory(state: ..., id: String) -> Result<(), String>

#[tauri::command]
pub async fn list_consolidations(state: ..., project_id: String) -> Result<Vec<Consolidation>, String>

#[tauri::command]
pub async fn extract_memories(
    state: ...,
    project_id: String,
    session_id: String,
    terminal_output: String,
    project_path: String,
) -> Result<Vec<Memory>, String> {
    // 1. Build extraction prompt from terminal_output
    // 2. Call arbiter_review with the prompt
    // 3. Parse structured facts from response
    // 4. Create Memory entries for each fact
    // 5. Auto-promote project-relevant memories to public visibility
    // 6. Return created memories
}

#[tauri::command]
pub async fn trigger_consolidation(state: ..., project_id: String, project_path: String) -> Result<(), String> {
    // Manual trigger for consolidation (normally runs in background)
}
```

- [ ] **Step 2: Define extraction prompt template**

The `extract_memories` command uses this prompt:
```
Analyze the following terminal output from an AI coding agent and extract important facts, decisions, and patterns.

Terminal output:
{terminal_output}

For each fact, respond with one line in this format:
MEMORY: {content} | IMPORTANCE: {0.0-1.0} | ENTITIES: {comma-separated} | TOPICS: {comma-separated} | VISIBILITY: {private|public}

Rules:
- Extract decisions ("chose React over Vue"), facts ("project uses PostgreSQL"), errors ("auth failed because X"), patterns ("uses barrel exports")
- Set VISIBILITY to "public" for project-wide decisions (tech stack, architecture, conventions)
- Set VISIBILITY to "private" for session-specific details (current task progress, temporary state)
- IMPORTANCE: 1.0 = critical architecture decision, 0.5 = useful fact, 0.1 = minor detail
- Only extract genuinely useful information, skip boilerplate and noise
```

- [ ] **Step 3: Register commands**

Add `pub mod memory_commands;` to `commands/mod.rs`.
Add all new commands to `generate_handler!` in `lib.rs`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/memory_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add memory extraction and management Tauri commands"
```

### Task 4: Implement background consolidation worker

**Files:**
- Create: `src-tauri/src/memory_worker.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create consolidation worker**

```rust
use tokio::sync::mpsc;
use crate::db::init::DbPool;

pub enum MemoryWorkerEvent {
    ConsolidateProject { project_id: String, project_path: String },
    PruneProject { project_id: String },
    Shutdown,
}

pub async fn run_memory_worker(
    db: DbPool,
    mut rx: mpsc::Receiver<MemoryWorkerEvent>,
) {
    while let Some(event) = rx.recv().await {
        match event {
            MemoryWorkerEvent::ConsolidateProject { project_id, project_path } => {
                consolidate_project(&db, &project_id, &project_path).await;
            }
            MemoryWorkerEvent::PruneProject { project_id } => {
                prune_project(&db, &project_id);
            }
            MemoryWorkerEvent::Shutdown => break,
        }
    }
}

async fn consolidate_project(db: &DbPool, project_id: &str, project_path: &str) {
    let conn = db.lock().unwrap();
    let count = crate::db::memory::count_unconsolidated(&conn, project_id).unwrap_or(0);
    if count < 10 { return; } // Only consolidate when 10+ unconsolidated

    let memories = crate::db::memory::get_unconsolidated_memories(&conn, project_id, 20).unwrap_or_default();
    drop(conn); // Release lock before CLI call

    // Build consolidation prompt
    let memory_text: String = memories.iter()
        .map(|m| format!("- {}", m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "Synthesize these related memories into a higher-level insight:\n\n{}\n\n\
         Respond with:\nSUMMARY: {{one paragraph synthesis}}\nINSIGHT: {{key takeaway or pattern}}",
        memory_text
    );

    // Call arbiter_review (need to resolve CLI command + model from settings)
    // Parse response for SUMMARY: and INSIGHT:
    // Create Consolidation entry
    // Mark source memories as consolidated
}

fn prune_project(db: &DbPool, project_id: &str) {
    let conn = db.lock().unwrap();
    let pruned = crate::db::memory::prune_decayed_memories(&conn, project_id).unwrap_or(0);
    if pruned > 0 {
        log::info!("Pruned {} decayed memories for project {}", pruned, project_id);
    }
}
```

- [ ] **Step 2: Add memory_worker_tx to AppState**

In `state.rs`, add:
```rust
pub memory_worker_tx: tokio::sync::mpsc::Sender<crate::memory_worker::MemoryWorkerEvent>,
```

- [ ] **Step 3: Start worker in lib.rs**

In `lib.rs` setup:
```rust
let (memory_tx, memory_rx) = tokio::sync::mpsc::channel(32);
tokio::spawn(memory_worker::run_memory_worker(db.clone(), memory_rx));
```

Add `memory_worker_tx: memory_tx` to AppState construction.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/memory_worker.rs src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat: add background memory consolidation worker"
```

---

## Chunk 2: Memory Integration & Frontend

### Task 5: Integrate memory into Arbiter's AnswerQuestion flow

**Files:**
- Modify: `src/lib/arbiter.ts`

- [ ] **Step 1: Load relevant memories before answering**

In `arbiterAnswer()`, before building the prompt:
```typescript
// Search for memories relevant to the current question
let memoryContext = "";
try {
  const memories = await searchMemories(
    compactText(output, 500), // Use terminal output as search query
    projectId,
    sessionId,
    5 // top 5 relevant memories
  );
  if (memories.length > 0) {
    memoryContext = "Relevant project memories:\n" +
      memories.map(m => `- ${m.content}`).join("\n");
  }
} catch {
  // proceed without memories
}
```

Then inject `memoryContext` into the prompt:
```typescript
const prompt =
  `You are an Arbiter agent reviewing an AI coding agent's question on a software project. ` +
  `${knowledgeSection} ` +
  `${memoryContext ? memoryContext + " " : ""}` +
  `Agent terminal output: ${compactOutput}. ...`;
```

- [ ] **Step 2: Extract memories after answering**

After the Arbiter answers, extract memories from the terminal output:
```typescript
// Fire-and-forget memory extraction
extractMemories(projectId, sessionId, output, projectPath).catch(() => {});
```

- [ ] **Step 3: Trigger consolidation check**

After extraction, notify the consolidation worker if needed. Add a new IPC function:
```typescript
export async function checkConsolidation(projectId: string, projectPath: string): Promise<void> {
  return invoke("check_consolidation", { projectId, projectPath });
}
```

The Rust handler sends a `ConsolidateProject` event to the memory worker.

- [ ] **Step 4: Commit**

```bash
git add src/lib/arbiter.ts src/lib/tauri.ts
git commit -m "feat: integrate memory retrieval and extraction into Arbiter flow"
```

### Task 6: Add TypeScript types and IPC for memory

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add memory types**

```typescript
export interface Memory {
  id: string;
  project_id: string;
  session_id: string | null;
  visibility: "private" | "public";
  content: string;
  summary: string | null;
  entities_json: string;
  topics_json: string;
  importance: number;
  consolidated: boolean;
  created_at: string;
}

export interface Consolidation {
  id: string;
  project_id: string;
  source_ids_json: string;
  summary: string;
  insight: string;
  created_at: string;
}
```

- [ ] **Step 2: Add IPC functions**

```typescript
export async function listMemories(projectId: string, sessionId?: string): Promise<Memory[]>
export async function searchMemories(query: string, projectId: string, sessionId?: string, limit?: number): Promise<Memory[]>
export async function toggleMemoryVisibility(id: string, visibility: string): Promise<void>
export async function deleteMemory(id: string): Promise<void>
export async function listConsolidations(projectId: string): Promise<Consolidation[]>
export async function extractMemories(projectId: string, sessionId: string, terminalOutput: string, projectPath: string): Promise<Memory[]>
export async function triggerConsolidation(projectId: string, projectPath: string): Promise<void>
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/tauri.ts
git commit -m "feat: add memory TypeScript types and IPC functions"
```

### Task 7: Create memory Zustand store

**Files:**
- Create: `src/stores/memoryStore.ts`

- [ ] **Step 1: Implement memory store**

```typescript
interface MemoryState {
  memories: Memory[];
  consolidations: Consolidation[];
  loading: boolean;
  loadMemories: (projectId: string, sessionId?: string) => Promise<void>;
  loadConsolidations: (projectId: string) => Promise<void>;
  searchMemories: (query: string, projectId: string) => Promise<void>;
  toggleVisibility: (id: string, visibility: "private" | "public") => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/memoryStore.ts
git commit -m "feat: add memory Zustand store"
```

### Task 8: Build Memory panel UI

**Files:**
- Create: `src/features/memory/components/MemoryPanel.tsx`
- Create: `src/features/memory/components/MemoryCard.tsx`
- Create: `src/features/memory/components/ConsolidationCard.tsx`

- [ ] **Step 1: Build MemoryCard**

Displays a single memory:
- Content text
- Importance badge (high/medium/low based on value)
- Visibility toggle (private/public switch)
- Session label (if session-owned)
- Entities/topics as tags
- Consolidated indicator
- Delete action
- Created timestamp with decay indicator

- [ ] **Step 2: Build ConsolidationCard**

Displays a consolidation:
- Summary text
- Insight text (highlighted)
- "N source memories" count
- Created timestamp

- [ ] **Step 3: Build MemoryPanel**

Main panel:
- Tabs: Memories | Consolidations
- Search bar (FTS5 search)
- Filter: All | Public | Private | Session-specific
- List of MemoryCard or ConsolidationCard components
- "Trigger consolidation" button
- Memory count and stats (total, public, consolidated)

- [ ] **Step 4: Add Memory panel to layout**

Add a new panel tab/section in the sidebar or panel switcher. The Memory panel is visible per project.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/
git commit -m "feat: build Memory panel UI with cards and consolidation view"
```

### Task 9: Build verification

- [ ] **Step 1: Verify Rust builds**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 2: Verify TypeScript builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Builds without errors

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues in memory system implementation"
```

---

## Verification Checklist

- [ ] Memories can be manually created via the extraction command
- [ ] Memory extraction parses Arbiter CLI response into structured memories
- [ ] FTS5 search returns relevant memories
- [ ] Scored retrieval orders by importance * recency correctly
- [ ] Private/public visibility toggle works
- [ ] Arbiter's AnswerQuestion loads relevant memories into its prompt
- [ ] Background consolidation worker triggers after 10+ unconsolidated memories
- [ ] Consolidation results appear in the UI
- [ ] Memory decay formula correctly reduces effective importance over time
- [ ] `cargo build` and `npm run build` both succeed
