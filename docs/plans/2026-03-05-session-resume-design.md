# Session Resume on App Start — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-resume all open CLI sessions when the app restarts, using each agent's native resume/continue flags.

**Architecture:** Persist lightweight session metadata to `sessions.json` on disk (same pattern as projects/settings). On startup, load persisted sessions, add them to the Zustand store with `isResumed: true`, and spawn each with the agent's resume CLI flags instead of starting fresh.

**Tech Stack:** Rust (Tauri backend, serde_json), TypeScript/React (Zustand store, Tauri invoke)

---

### Task 1: Add `resume_args` to AgentDefinition (Backend)

**Files:**
- Modify: `src-tauri/src/state.rs:46-57` (AgentDefinition struct)
- Modify: `src-tauri/src/agents/registry.rs` (all 4 agent definitions)

**Step 1: Add field to AgentDefinition struct**

In `src-tauri/src/state.rs`, add `resume_args` to the `AgentDefinition` struct:

```rust
#[derive(Debug, Clone)]
pub struct AgentDefinition {
    pub agent_type: AgentType,
    pub display_name: String,
    pub command: String,
    pub default_args: Vec<String>,
    pub yolo_flag: String,
    pub resume_args: Vec<String>,
    pub detect_idle_pattern: String,
    pub detect_input_pattern: String,
    pub detect_finished_pattern: String,
    pub icon: String,
}
```

**Step 2: Populate resume_args in registry**

In `src-tauri/src/agents/registry.rs`, add `resume_args` to each agent definition:

- Claude: `resume_args: vec!["--continue".to_string()]`
- Gemini: `resume_args: vec!["--resume".to_string()]`
- Copilot: `resume_args: vec!["--continue".to_string()]`
- Codex: `resume_args: vec!["resume".to_string(), "--last".to_string()]`

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors

**Step 4: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/agents/registry.rs
git commit -m "feat: add resume_args to AgentDefinition"
```

---

### Task 2: Add session persistence module (Backend)

**Files:**
- Create: `src-tauri/src/sessions/mod.rs`
- Create: `src-tauri/src/sessions/store.rs`
- Modify: `src-tauri/src/lib.rs:6` (add `pub mod sessions;`)

**Step 1: Create sessions module**

Create `src-tauri/src/sessions/mod.rs`:

```rust
pub mod store;
```

**Step 2: Create session store**

Create `src-tauri/src/sessions/store.rs` following the exact same pattern as `settings/store.rs`:

```rust
use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use crate::state::AgentType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: String,
    pub project_id: String,
    pub agent_type: AgentType,
    pub yolo_mode: bool,
    pub label: String,
    pub is_guardian: bool,
    pub created_at: String,
}

fn sessions_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot find data directory".to_string())?;
    Ok(base.join("com.agentic.app").join("sessions.json"))
}

pub fn load_sessions() -> Vec<PersistedSession> {
    let path = match sessions_path() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    if !path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_sessions(sessions: &[PersistedSession]) -> Result<(), String> {
    let path = sessions_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create sessions directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write sessions: {}", e))
}
```

**Step 3: Register module in lib.rs**

Add `pub mod sessions;` to `src-tauri/src/lib.rs` after `pub mod pty;`.

**Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/sessions/ src-tauri/src/lib.rs
git commit -m "feat: add session persistence module"
```

---

### Task 3: Add Tauri commands for session persistence

**Files:**
- Create: `src-tauri/src/commands/session_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs` (add module)
- Modify: `src-tauri/src/lib.rs` (register commands + import)

**Step 1: Create session commands**

Create `src-tauri/src/commands/session_commands.rs`:

```rust
use crate::sessions::store::{self, PersistedSession};

#[tauri::command]
pub async fn save_sessions(sessions: Vec<PersistedSession>) -> Result<(), String> {
    store::save_sessions(&sessions)
}

#[tauri::command]
pub async fn load_sessions() -> Result<Vec<PersistedSession>, String> {
    Ok(store::load_sessions())
}
```

**Step 2: Register in commands/mod.rs**

Add `pub mod session_commands;` to `src-tauri/src/commands/mod.rs`.

**Step 3: Register in lib.rs**

Add import:
```rust
use commands::session_commands::{save_sessions, load_sessions};
```

Add to `invoke_handler` in the handler list:
```rust
save_sessions,
load_sessions,
```

**Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/commands/session_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add save_sessions and load_sessions Tauri commands"
```

---

### Task 4: Update frontend types and Tauri wrappers

**Files:**
- Modify: `src/types/index.ts:21-30` (AgentSession interface)
- Modify: `src/types/index.ts:32-42` (AgentDefinition interface)
- Modify: `src/lib/tauri.ts` (add invoke wrappers)

**Step 1: Add `isResumed` to AgentSession**

In `src/types/index.ts`, add `isResumed` field to `AgentSession`:

```typescript
export interface AgentSession {
  id: string;
  projectId: string;
  agentType: AgentType;
  status: AgentStatus;
  yoloMode: boolean;
  createdAt: string;
  label: string;
  isGuardian: boolean;
  isResumed: boolean;
}
```

**Step 2: Add `resume_args` to AgentDefinition**

In `src/types/index.ts`, add to `AgentDefinition`:

```typescript
export interface AgentDefinition {
  agent_type: AgentType;
  display_name: string;
  command: string;
  default_args: string[];
  yolo_flag: string;
  resume_args: string[];
  detect_idle_pattern: string;
  detect_input_pattern: string;
  detect_finished_pattern: string;
  icon: string;
}
```

**Step 3: Add PersistedSession type**

In `src/types/index.ts`, add:

```typescript
export interface PersistedSession {
  id: string;
  project_id: string;
  agent_type: AgentType;
  yolo_mode: boolean;
  label: string;
  is_guardian: boolean;
  created_at: string;
}
```

**Step 4: Add Tauri invoke wrappers**

In `src/lib/tauri.ts`, add:

```typescript
import type { PersistedSession } from "@/types";

export async function saveSessions(sessions: PersistedSession[]): Promise<void> {
  return invoke("save_sessions", { sessions });
}

export async function loadSessions(): Promise<PersistedSession[]> {
  return invoke("load_sessions");
}
```

**Step 5: Fix existing code that creates AgentSession objects**

Search for all places that create `AgentSession` objects and add `isResumed: false`. Key locations:
- The `NewAgentDialog` component (or wherever sessions are created from UI)
- Any guardian session creation code

Run: `grep -rn "isGuardian" src/` to find all session creation sites and add `isResumed: false` to each.

**Step 6: Verify frontend compiles**

Run: `npm run build` (or `pnpm build` / `bun build` — check package.json for the correct command)
Expected: compiles with no errors

**Step 7: Commit**

```bash
git add src/types/index.ts src/lib/tauri.ts
git commit -m "feat: add session resume types and Tauri wrappers"
```

---

### Task 5: Add persistence to session store

**Files:**
- Modify: `src/stores/sessionStore.ts`

**Step 1: Add persist and load functions**

Update `src/stores/sessionStore.ts` to add `persistSessions` and `loadPersistedSessions`:

```typescript
import { create } from "zustand";
import type { AgentSession, AgentStatus, PersistedSession } from "@/types";
import { saveSessions, loadSessions } from "@/lib/tauri";

interface SessionState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  addSession: (session: AgentSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (id: string, status: AgentStatus) => void;
  updateSessionYolo: (id: string, yoloMode: boolean) => void;
  persistSessions: () => void;
  loadPersistedSessions: () => Promise<void>;
}
```

**Step 2: Implement persistSessions**

Add to the store actions:

```typescript
persistSessions: () => {
  const { sessions } = get();
  const persisted: PersistedSession[] = sessions
    .filter((s) => s.status !== "error" && s.status !== "finished")
    .map((s) => ({
      id: s.id,
      project_id: s.projectId,
      agent_type: s.agentType,
      yolo_mode: s.yoloMode,
      label: s.label,
      is_guardian: s.isGuardian,
      created_at: s.createdAt,
    }));
  saveSessions(persisted).catch((err) => {
    console.error("Failed to persist sessions:", err);
  });
},
```

Note: Change `create<SessionState>((set) => ({` to `create<SessionState>((set, get) => ({` to access `get`.

**Step 3: Implement loadPersistedSessions**

```typescript
loadPersistedSessions: async () => {
  try {
    const persisted = await loadSessions();
    if (persisted.length === 0) return;

    const resumed: AgentSession[] = persisted.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      agentType: p.agent_type,
      status: "starting" as const,
      yoloMode: p.yolo_mode,
      createdAt: p.created_at,
      label: p.label,
      isGuardian: p.is_guardian,
      isResumed: true,
    }));

    set((state) => ({
      sessions: [...state.sessions, ...resumed],
      activeSessionId: resumed[resumed.length - 1]?.id ?? state.activeSessionId,
    }));
  } catch (err) {
    console.error("Failed to load persisted sessions:", err);
  }
},
```

**Step 4: Call persistSessions on session add/remove**

In `addSession` and `removeSession`, call `get().persistSessions()` after state update:

```typescript
addSession: (session: AgentSession) => {
  set((state) => ({
    sessions: [...state.sessions, session],
    activeSessionId: session.id,
  }));
  get().persistSessions();
},

removeSession: (id: string) => {
  set((state) => {
    const sessions = state.sessions.filter((s) => s.id !== id);
    const activeSessionId =
      state.activeSessionId === id
        ? sessions.length > 0
          ? sessions[sessions.length - 1].id
          : null
        : state.activeSessionId;
    return { sessions, activeSessionId };
  });
  get().persistSessions();
},
```

**Step 5: Commit**

```bash
git add src/stores/sessionStore.ts
git commit -m "feat: add session persistence to sessionStore"
```

---

### Task 6: Wire up resume in TerminalPanel

**Files:**
- Modify: `src/features/terminal/components/TerminalPanel.tsx:61-94` (doSpawn callback)

**Step 1: Modify doSpawn to use resume args**

In `TerminalPanel.tsx`, update the `doSpawn` callback. After building the base args, check `session.isResumed` and prepend resume args:

```typescript
const doSpawn = useCallback(
  async (term: Terminal, fitAddon: FitAddon) => {
    if (spawnedRef.current) return;
    if (!agentDefRef.current) return;
    spawnedRef.current = true;

    updateStatus(session.id, "starting");

    try {
      fitAddon.fit();
      const { cols, rows } = term;
      const agentDef = agentDefRef.current;

      const cmdParts = agentDef.command.split(" ");
      const command = cmdParts[0];
      const baseArgs = cmdParts.slice(1);
      const defaultArgs = agentDef.default_args ?? [];
      const customArgs = settings.agents[session.agentType]?.custom_args ?? [];
      const envVars = settings.agents[session.agentType]?.env_vars ?? {};
      const resumeArgs = session.isResumed ? (agentDef.resume_args ?? []) : [];

      const args = session.yoloMode
        ? [...baseArgs, ...resumeArgs, ...defaultArgs, ...customArgs, agentDef.yolo_flag].filter(Boolean)
        : [...baseArgs, ...resumeArgs, ...defaultArgs, ...customArgs].filter(Boolean);

      await spawnPty(session.id, command, args, projectPath, envVars, cols, rows);
      updateStatus(session.id, "idle");
    } catch (err) {
      console.error("Failed to spawn PTY:", err);
      term.writeln("\r\n\x1b[31mFailed to start agent process.\x1b[0m");
      updateStatus(session.id, "error");
      spawnedRef.current = false;
    }
  },
  [session.id, session.yoloMode, session.isResumed, session.agentType, projectPath, settings.agents, updateStatus],
);
```

Key change: Added `resumeArgs` line and included it in args array. Added `session.isResumed` to dependency array.

**Step 2: Commit**

```bash
git add src/features/terminal/components/TerminalPanel.tsx
git commit -m "feat: use resume args when spawning resumed sessions"
```

---

### Task 7: Wire up auto-resume on app start + beforeunload persistence

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add loadPersistedSessions to App init**

In `src/App.tsx`, import from sessionStore and call on mount:

```typescript
import { useSessionStore } from "@/stores/sessionStore";

// Inside App component:
const { loadPersistedSessions } = useSessionStore();

useEffect(() => {
  loadProjects();
  loadSettings();
  loadPersistedSessions();
}, [loadProjects, loadSettings, loadPersistedSessions]);
```

**Step 2: Add beforeunload handler**

Add a `useEffect` that persists sessions on window close:

```typescript
useEffect(() => {
  const handleBeforeUnload = () => {
    useSessionStore.getState().persistSessions();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, []);
```

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: auto-resume sessions on app start"
```

---

### Task 8: Verify end-to-end

**Step 1: Build and run**

Run: `npm run tauri dev` (or the project's dev command)
Expected: app starts without errors

**Step 2: Manual test flow**

1. Start the app
2. Create a new Claude session, send a message
3. Close the app
4. Check `~/.local/share/com.agentic.app/sessions.json` exists and contains the session
5. Restart the app
6. Verify the session tab reappears automatically
7. Verify Claude launches with `--continue` flag and resumes the conversation

**Step 3: Edge cases to verify**

- App starts with no `sessions.json` — should work normally (no crash, no resumed sessions)
- Session with deleted project — should still spawn (uses project path from project store)
- All sessions in error/finished state — nothing should be resumed (filtered out in persistSessions)

**Step 4: Final commit if any fixes needed**
