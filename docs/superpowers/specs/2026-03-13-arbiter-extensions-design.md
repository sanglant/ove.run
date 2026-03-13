# OVE.RUN Arbiter Extensions Design Spec

**Date:** 2026-03-13
**Status:** Approved
**Approach:** Foundation-First (build data layer, then intelligence, then loop)

---

## Overview

This spec covers the evolution of ove.run from a multi-agent terminal manager into an intelligent orchestrator. Three unified systems replace existing file-based storage, the Arbiter expands from a reactive question-answerer into a planning/orchestrating brain, and a Loop Engine enables autonomous project completion.

### Design Decisions

- **Approach:** Foundation-First — SQLite and data layer first, Arbiter intelligence second, Loop Engine last
- **Arbiter authority:** Adjustable trust levels per project (Supervised / Autonomous / Full Auto), default: Autonomous
- **Loop architecture:** Hybrid — Rust state machine for reliability, Arbiter CLI calls for intelligence
- **LLM integration:** Arbiter reasoning calls go through CLI (`-p` flag for non-interactive LLM queries). Loop Engine agent spawning uses per-agent `PromptDelivery` strategies (see Section 5.2). No direct API dependencies.
- **Storage:** Single SQLite database, clean start (no migration from existing JSON)
- **Naming:** Unify all "guardian" references to "arbiter" across the stack
- **Agent support:** Loop Engine is agent-agnostic with per-agent prompt delivery strategies
- **Zero friction:** No OAuth, API keys, or external service dependencies for users

---

## 1. Foundation — SQLite & Naming Unification

### 1.1 Guardian to Arbiter Rename

Full rename across the entire stack:

**Rust backend:** Rename all identifiers matching `guardian*` to `arbiter*`. Key renames include:
- `guardian_review` -> `arbiter_review`
- `guardian_enabled` -> `arbiter_enabled`
- `guardian_timeout_seconds` -> `arbiter_timeout_seconds`
- `guardian_provider` -> `arbiter_provider`
- `guardian_agent_type` -> `arbiter_agent_type`
- `guardian_model` -> `arbiter_model`
- `default_guardian_timeout` -> `default_arbiter_timeout`

**TypeScript frontend:** Already uses "arbiter" — verify consistency.

**Stored settings:** Clean start, no migration needed.

**Breaking change:** Existing users will lose JSON-stored projects, knowledge, and notes. This is accepted — clean start, no migration. Document in release notes.

### 1.2 SQLite Database

Single database file at Tauri's `app_data_dir()`:
- Linux: `~/.local/share/com.overun.app/ove.db`
- macOS: `~/Library/Application Support/com.overun.app/ove.db`
- Windows: `AppData/Roaming/com.overun.app/ove.db`

Added to `.gitignore` to prevent personal data from being pushed to the repository.

**Rust dependency:** `rusqlite` with `bundled` + `fts5` features (embeds SQLite, no system dependency).

### 1.3 Schema

```sql
-- Replaces projects.json
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    git_enabled INTEGER NOT NULL DEFAULT 0,
    arbiter_enabled INTEGER NOT NULL DEFAULT 0,
    arbiter_agent_type TEXT,
    created_at TEXT NOT NULL
);

-- Replaces settings.json
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

-- Replaces sessions.json
-- Note: status, isResumed are runtime-only (in-memory AppState), not persisted.
-- initial_prompt is persisted for loop replay/retry.
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    yolo_mode INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    initial_prompt TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- System 1: Context Store (replaces knowledge system)
-- Uses integer rowid for FTS5 content-sync compatibility
CREATE TABLE context_units (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    project_id TEXT,              -- NULL for global scope
    name TEXT NOT NULL,
    type TEXT NOT NULL,           -- persona, skill, knowledge, reference
    scope TEXT NOT NULL,          -- global, project
    tags_json TEXT DEFAULT '[]',
    l0_summary TEXT,              -- ~100 tokens, always scanned
    l1_overview TEXT,             -- ~2k tokens, loaded on match
    l2_content TEXT,              -- full content, loaded on demand
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Context assignment to sessions
CREATE TABLE context_assignments (
    context_unit_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    PRIMARY KEY (context_unit_id, session_id),
    FOREIGN KEY (context_unit_id) REFERENCES context_units(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Project-level default context
CREATE TABLE context_defaults (
    context_unit_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    PRIMARY KEY (context_unit_id, project_id),
    FOREIGN KEY (context_unit_id) REFERENCES context_units(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- User notes (not auto-loaded into agent context)
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    include_in_context INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- System 2: Agent Memory
-- Uses integer rowid for FTS5 content-sync compatibility
-- Ownership derived from session_id: NULL = project-level, non-NULL = session-owned
CREATE TABLE memories (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL,
    session_id TEXT,              -- NULL = project-level memory, non-NULL = session-owned
    visibility TEXT NOT NULL DEFAULT 'private', -- private, public
    content TEXT NOT NULL,
    summary TEXT,
    entities_json TEXT DEFAULT '[]',
    topics_json TEXT DEFAULT '[]',
    importance REAL NOT NULL DEFAULT 0.5,
    consolidated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Memory consolidations
CREATE TABLE consolidations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_ids_json TEXT NOT NULL,
    summary TEXT NOT NULL,
    insight TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Arbiter state per project
CREATE TABLE arbiter_state (
    project_id TEXT PRIMARY KEY,
    trust_level INTEGER NOT NULL DEFAULT 2,
    loop_status TEXT NOT NULL DEFAULT 'idle', -- idle, planning, running, paused, completed, failed
    current_story_id TEXT,
    iteration_count INTEGER NOT NULL DEFAULT 0,
    max_iterations INTEGER NOT NULL DEFAULT 50,
    last_activity_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Loop stories (PRD items)
CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, skipped
    depends_on_json TEXT DEFAULT '[]',
    iteration_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Bug provider configs (replaces bugs/{project_id}/)
CREATE TABLE bug_configs (
    project_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    auth_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- FTS5 virtual tables
CREATE VIRTUAL TABLE context_units_fts USING fts5(
    name, l0_summary, l1_overview, l2_content,
    content=context_units, content_rowid=rid
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
    content, summary,
    content=memories, content_rowid=rid
);

CREATE VIRTUAL TABLE consolidations_fts USING fts5(
    summary, insight,
    content=consolidations
);

-- FTS5 sync triggers (insert/update/delete on source tables must
-- mirror changes into FTS tables via INSERT/DELETE on the shadow tables).
-- Implementation: use rusqlite after_insert/after_delete hooks or
-- explicit trigger statements in the migration.
```

---

## 2. Context Store (System 1)

### 2.1 Context Unit Types

| Type | Creator | Purpose |
|------|---------|---------|
| `persona` | System/user | Agent role definition (e.g., "Backend Developer", "Security Auditor") |
| `skill` | System/user | Capability instructions (e.g., design references, code review guidelines) |
| `knowledge` | Arbiter/system | Auto-generated project context with L0/L1/L2 tiers |
| `reference` | User | Docs, guides, API references the user wants agents to know |

### 2.2 Tiered Loading (L0/L1/L2)

Inspired by OpenViking's tiered context system:

- **L0 (~100 tokens):** One-line summary. Always scanned by the Arbiter when selecting context.
- **L1 (~2k tokens):** Structured overview. Loaded when L0 matches the current task.
- **L2 (full content):** Complete content. Loaded only when deep detail is needed.

**Generation:**
- User-created content: L2 is provided by user, Arbiter generates L0 + L1 via CLI call in background.
- Arbiter-created knowledge: All three tiers generated by Arbiter.

### 2.3 Context Assignment

**Project defaults:** Context units assigned as defaults for a project. Every new session in that project inherits them.

**Session-specific:** Arbiter can add more context units based on task intent (at trust level 2+). User can manually assign/unassign.

**Session creation flow:**
1. Copy all `context_defaults` for the project as assignments
2. If Arbiter enabled: Arbiter scans L0 summaries and adds relevant units
3. User can adjust before or during session

### 2.4 Bundled Content

Ships with ove.run (scope = `global`):
- 10-15 curated personas adapted from agency-agents (Apache 2.0)
- 5-10 high-value skills including Impeccable design references
- User can enable/disable per project

### 2.5 Notes (Separate from Context)

Notes are user-only by default. They live in the `notes` table with an `include_in_context` boolean toggle. Default: off.

When toggled on, the note's content is injected as L2 content alongside regular context units. This gives users explicit control over what agents see.

### 2.6 UI

The existing Knowledge panel evolves into a **Context panel:**
- Filter by type: All | Personas | Skills | Knowledge | References
- Toggle to assign/unassign per session
- Project defaults management
- L0/L1/L2 viewer (expandable tiers)
- Separate Notes tab with "include in context" toggle per note

---

## 3. Agent Memory (System 2)

### 3.1 Memory Extraction

The Arbiter extracts memories from agent terminal output:

- **When:** After a story completes, after a session ends, or periodically during long sessions
- **How:** Arbiter CLI call with recent terminal output, returns structured facts
- **What:** Decisions ("chose Next.js"), facts ("project uses PostgreSQL"), errors ("auth failed because X"), patterns ("codebase uses barrel exports")

### 3.2 Visibility Model

- **Private** (default): Only the originating session sees it
- **Public**: Visible to all sessions in the project

Arbiter auto-promotes memories to public when project-relevant (tech stack decisions, architecture choices). User can toggle manually.

### 3.3 Consolidation Loop

Background process when Arbiter is enabled:

1. Scan unconsolidated memories for a project
2. Group by topic/entity overlap
3. Arbiter CLI call: synthesize N memories into higher-level insight
4. Store as consolidation, mark source memories as consolidated
5. Consolidations become preferred retrieval targets (fewer, richer)

**Triggers:** After every 10 new memories, on session end, or on user request.

### 3.4 Memory Retrieval

When the Arbiter needs context:

1. FTS5 keyword search against `memories_fts` and consolidations
2. Filter by project + visibility
3. Sort by importance * recency_factor
4. Load top N results into the Arbiter's prompt

### 3.5 Memory Decay

```
effective_importance = importance * max(0, 1 - days_since_creation / 90)
```

Linear decay over 90 days. A memory with importance=1.0 created today has effective_importance=1.0; after 45 days it's 0.5; after 90 days it's 0.

- Consolidated memories don't decay (already distilled)
- Unconsolidated memories with effective_importance < 0.05 are pruned

---

## 4. Expanded Arbiter

### 4.1 Trust Levels

Prompted when user toggles Arbiter on for a project. Default: **Autonomous**.

| Level | Name | Description |
|-------|------|-------------|
| 1 | **Supervised** | "I'll approve each step" |
| 2 | **Autonomous** | "Run it, ask me when stuck" |
| 3 | **Full Auto** | "Handle everything" |

Stored in `arbiter_state.trust_level` per project. Changeable at any time, takes effect on next iteration.

### 4.2 Responsibility Matrix

| Responsibility | Supervised (1) | Autonomous (2) | Full Auto (3) |
|---------------|----------------|-----------------|----------------|
| Answer agent questions | Yes | Yes | Yes |
| Extract memories | Yes | Yes | Yes |
| Generate L0/L1 summaries | Yes | Yes | Yes |
| Consolidate memories (background) | Yes | Yes | Yes |
| Decompose request into PRD | Suggests, user approves | Yes | Yes |
| Pick tech stack | Suggests, user approves | Suggests, user approves | Yes |
| Select next story | No (user picks) | Yes | Yes |
| Spawn/kill agent sessions | No | Yes | Yes |
| Judge story completion | No (user confirms) | Yes | Yes |
| Architecture decisions | No | Pauses, asks user | Yes |
| Retry failed stories | No | Yes (max 3) | Yes (max 5) |

### 4.3 Arbiter Actions

The Arbiter becomes a state machine with distinct action types, each with its own prompt template:

| Action | Input | Output |
|--------|-------|--------|
| `AnswerQuestion` | Terminal output + options + memory context | Selected option or free text |
| `DecomposeRequest` | User's natural language request + project context | Structured PRD with stories |
| `SelectNextStory` | Plan + memory + completed stories | Next story ID |
| `JudgeCompletion` | Test output + acceptance criteria | Pass/fail + reasoning |
| `ExtractMemories` | Terminal output chunk | Structured facts/decisions/entities |
| `ConsolidateMemory` | Batch of related memories | Synthesized insight |
| `GenerateSummary` | L2 content | L0 summary + L1 overview |

All actions go through the same `arbiter_review` CLI call path with different prompt templates.

### 4.4 Arbiter State

Per-project state stored in `arbiter_state` table:

- `trust_level` — 1, 2, or 3
- `loop_status` — idle | planning | running | paused | completed | failed
- `current_story_id` — active story
- `iteration_count` — total iterations in current loop run
- `max_iterations` — hard stop (default: 50)
- `last_activity_at` — for idle detection

---

## 5. Loop Engine

### 5.1 Overview

Agent-agnostic loop engine managed by a Rust state machine. Inspired by the Ralph Loop pattern but fundamentally different: supports any registered agent, uses SQLite + memory for persistence, enables multi-agent parallelism, and provides full user control.

### 5.2 Per-Agent Prompt Delivery

Each agent type has a different mechanism for receiving the initial task:

```rust
pub enum PromptDelivery {
    CliFlag(String),      // e.g., "-p" — append prompt as flag value
    PositionalArg,        // prompt as first positional argument
    InteractiveInput,     // wait for idle, write prompt to PTY
}
```

| Agent | Delivery | Behavior | Needs Input Support |
|-------|----------|----------|---------------------|
| Claude | `InteractiveInput` | Spawn in interactive mode, write prompt to PTY | Yes — Arbiter answers mid-run questions |
| Gemini | `InteractiveInput` | Spawn, wait for idle, write prompt to PTY | Yes |
| Codex | `PositionalArg` | Pass story prompt as first arg, process exits when done | No — fire and forget |
| Copilot | `InteractiveInput` | Spawn, wait for idle, write prompt to PTY | Yes |
| Terminal | N/A | Not used in loop engine | N/A |

**Note on Claude:** Although Claude supports `-p` for non-interactive mode, the loop uses `InteractiveInput` to preserve the Arbiter's ability to answer mid-run questions. The `-p` flag causes Claude to run headlessly without presenting interactive prompts, which would bypass the Arbiter's `AnswerQuestion` capability.

Add `prompt_delivery: Option<PromptDelivery>` to `AgentDefinition`. `None` means the agent is not loop-capable (e.g., Terminal).

### 5.3 Completion Detection

How the loop knows a story iteration is done:

1. **Process exits** (flag-based agents) — definitive completion signal
2. **`detect_finished_pattern` matches** (interactive agents) — agent explicitly signals done
3. **`detect_idle_pattern` matches + no output for N seconds** — likely done, run quality gates to confirm

Idle timeout configurable per agent (default: 30 seconds).

### 5.4 Loop Lifecycle

```
User request
  -> Arbiter: DecomposeRequest -> stories created in DB
  -> Loop status: planning -> running

For each iteration:
  1. Arbiter: SelectNextStory (priority + dependencies + memory)
  2. Arbiter assembles context prompt:
     - Persona context (from assigned context_units)
     - Skill context (from assigned context_units)
     - Project knowledge (relevant L1 summaries)
     - Relevant memories (FTS5 query for current story)
     - Story description + acceptance criteria
     - Previous failure context (if retry)
     - Quality gate commands
  3. Rust spawns fresh agent session with prompt (via PromptDelivery)
  4. Agent works until completion detected
  5. If needs_input -> Arbiter: AnswerQuestion (existing flow)
  6. If completed -> run quality gates
  7. Gates pass -> Arbiter: ExtractMemories, mark story complete, next iteration
  8. Gates fail -> record failure in memory, retry or pause per trust level
  9. All stories complete -> loop_status = completed
```

### 5.5 Quality Gates

Run after each story iteration. Configurable per project:

| Gate | Command (user-configured) | Example |
|------|--------------------------|---------|
| Build | Build command | `npm run build`, `cargo build` |
| Lint | Lint command | `npm run lint`, `cargo clippy` |
| Type check | Type check command | `npx tsc --noEmit` |
| Test | Test command | `npm test`, `cargo test` |
| Arbiter judge | Automatic | LLM reviews output against acceptance criteria |

Gates are optional and individually toggleable. Gate results (stdout/stderr) fed into next iteration's context if retry is needed.

### 5.6 Circuit Breakers

| Condition | Action |
|-----------|--------|
| Same story fails 3x (Autonomous) / 5x (Full Auto) | Pause, notify user |
| No commit in 3 consecutive iterations | Pause, notify user |
| Max iterations reached (default: 50) | Stop loop |
| Total iterations exceed user-set limit | Pause, notify user |

**Note:** Token cost tracking is not feasible with CLI-only integration (agent processes don't expose token counts to the parent). The iteration count limit serves as a cost proxy — each iteration is roughly one agent session. Users can set `max_iterations` per project to control total cost.

### 5.7 Multi-Agent Loops

When stories have no dependencies:

- Arbiter identifies independent story groups
- Spawns one agent session per group (up to concurrent limit, default: 2)
- Each runs its own iteration cycle
- Cross-agent memory (public visibility) prevents conflicts
- Arbiter coordinates via shared arbiter_state

### 5.8 User Controls

| Control | Behavior |
|---------|----------|
| **Start loop** | From natural language request or imported PRD |
| **Pause** | Finishes current iteration, then pauses |
| **Resume** | Continues from next pending story |
| **Edit plan** | Pauses first, user adds/removes/reorders stories |
| **Intervene** | User takes over a session manually, hands back when done |
| **Cancel** | Stops loop, keeps all completed work |

### 5.9 Progress UI

- Stories list with status indicators (pending/in_progress/completed/failed)
- Current iteration number and max
- Diff viewer per completed story
- Arbiter reasoning log (why it picked this story, what it decided)
- Circuit breaker status

### 5.10 State Persistence

Loop state in SQLite (`arbiter_state` + `stories` tables). On crash/restart:

- Completed stories stay completed (commits in git)
- In-progress story restarts from scratch (fresh context principle)
- Loop resumes from where it stopped

---

## 6. Orchestration Patterns

### 6.1 Three Patterns

| Pattern | When | How |
|---------|------|-----|
| **Sequential (Handoff)** | Stories with `depends_on` | Story A completes -> its memories feed into Story B's context |
| **Parallel (Assign)** | Independent stories | Multiple agents run simultaneously, up to concurrent limit |
| **Collaborative (Message)** | Concurrent agents need shared decisions | Arbiter extracts memories periodically and injects cross-relevant context into other agent's next restart |

### 6.2 Arbiter as Orchestrator

The Arbiter infers the pattern from the story dependency graph:

- Stories with dependencies -> Sequential
- Stories without dependencies -> Parallel
- Collaborative is implicit: cross-agent memory sharing happens automatically via public memories

No user configuration needed.

### 6.3 Periodic Memory Extraction for Collaboration

For concurrent agents, the Arbiter extracts memories more frequently to enable collaboration:

- **After each agent restart** (between iterations) — standard extraction
- **On `needs_input` events** — the Arbiter extracts memories from recent output before answering, making new knowledge available to other agents
- **Cross-injection happens at iteration boundaries** — when Agent B starts its next iteration, it receives relevant public memories from Agent A's recent work

Memories are NOT injected mid-session into a running agent's PTY. They are loaded into the next iteration's context prompt. This keeps the fresh-context principle intact.

### 6.4 Promptfoo Integration (Dev-time only)

Not user-facing. Added to the project's dev toolchain:

- Test suite for each Arbiter action prompt template
- Regression tests for option matching and response parsing
- Run via CI before merging Arbiter prompt changes
- Configured via `promptfoo.yaml` in the repo

---

## Implementation Order

Foundation-First approach:

1. **Guardian -> Arbiter rename** (full stack)
2. **SQLite foundation** (schema, rusqlite integration, replace all JSON storage)
3. **Context Store** (context_units CRUD, L0/L1/L2 generation, assignment system, bundled content, UI)
4. **Notes system** (notes CRUD, include_in_context toggle, UI)
5. **Agent Memory** (extraction, storage, FTS5 search, visibility, consolidation loop)
6. **Expanded Arbiter** (trust levels, all 7 action types, state machine, trust level prompt on toggle)
7. **Loop Engine** (prompt delivery per agent, loop lifecycle, quality gates, circuit breakers, completion detection, UI)
8. **Orchestration** (sequential/parallel/collaborative patterns, multi-agent coordination)
9. **Promptfoo integration** (dev-time Arbiter prompt testing)

---

## Constraints

- **Zero friction:** No OAuth, API keys, or external service dependencies for end users
- **SQLite only:** No external databases. `rusqlite` with bundled SQLite + FTS5
- **CLI-based LLM:** All Arbiter intelligence goes through CLI agent calls, no direct API integration
- **Agent-agnostic:** Loop Engine works with any registered agent type
- **Clean start:** No migration from existing JSON storage
- **Privacy:** SQLite database file in `.gitignore` to prevent personal data in repo
