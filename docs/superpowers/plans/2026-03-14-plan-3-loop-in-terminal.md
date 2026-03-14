# Loop-in-Terminal with Artifacts Pane — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone Loop panel with an artifacts pane in the terminal grid. The loop engine reuses a single PTY session, respawning the agent per story.

**Architecture:** Extend TerminalPaneLayoutNode with a `paneType` field. Create an ArtifactsPane component that renders in the grid alongside the terminal. Modify LoopCommand::Start to accept a session_id so the engine reuses the same PTY. Remove the Loop panel, LoopFloatingPreview, and loop sidebar nav entry.

**Tech Stack:** React (Mantine), Zustand, Rust (loop engine, PTY manager), Tauri IPC

---

### Task 1: Extend layout system with pane types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add paneType to TerminalPaneLayoutNode**

```typescript
export interface TerminalPaneLayoutNode {
  type: "pane";
  id: string;
  sessionId: string | null;
  paneType?: "terminal" | "artifacts";
}
```

Default is `"terminal"` (undefined means terminal).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add paneType field to TerminalPaneLayoutNode"
```

---

### Task 2: Create ArtifactsPane component

**Files:**
- Create: `src/features/terminal/components/ArtifactsPane.tsx`
- Create: `src/features/terminal/components/ArtifactsPane.module.css`

- [ ] **Step 1: Create the CSS module**

`src/features/terminal/components/ArtifactsPane.module.css`:

```css
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 8px;
}

.headerTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.counter {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono, "Geist Mono", monospace);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.section {
  margin-bottom: 12px;
}

.sectionLabel {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.storyCard {
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  margin-bottom: 4px;
  cursor: pointer;
}

.storyCard[data-active="true"] {
  border-color: var(--accent);
}

.storyRow {
  display: flex;
  align-items: center;
  gap: 6px;
}

.storyTitle {
  font-size: 12px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storyDesc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dotPending { background: var(--text-tertiary); }
.dotInProgress { background: var(--accent); }
.dotCompleted { background: var(--success); }
.dotFailed { background: var(--danger); }
.dotSkipped { background: var(--text-tertiary); opacity: 0.5; }

.gateRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 11px;
}

.gateName {
  color: var(--text-secondary);
}

.gatePass { color: var(--success); }
.gateFail { color: var(--danger); }

.reasoningEntry {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}

.reasoningAction {
  font-weight: 500;
  color: var(--text-primary);
}

.empty {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary);
  font-size: 12px;
}
```

- [ ] **Step 2: Create the ArtifactsPane component**

`src/features/terminal/components/ArtifactsPane.tsx`:

```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useLoopStore } from "@/stores/loopStore";
import type { Story, StoryStatus, GateResult } from "@/types";
import classes from "./ArtifactsPane.module.css";

const DOT_CLASS: Record<StoryStatus, string> = {
  pending: classes.dotPending,
  in_progress: classes.dotInProgress,
  completed: classes.dotCompleted,
  failed: classes.dotFailed,
  skipped: classes.dotSkipped,
};

export function ArtifactsPane() {
  const { stories, status, iterationCount, maxIterations, gateResults, reasoningLog } = useLoopStore();
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const completed = stories.filter((s) => s.status === "completed").length;
  const total = stories.length;
  const activeStory = stories.find((s) => s.status === "in_progress");

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <span className={classes.headerTitle}>Arbiter</span>
          {activeStory && (
            <span className={classes.counter} title={activeStory.title}>
              {activeStory.title.length > 20 ? activeStory.title.slice(0, 20) + "…" : activeStory.title}
            </span>
          )}
        </div>
        <span className={classes.counter}>
          {iterationCount}/{maxIterations} · {completed}/{total} stories
        </span>
      </div>

      {/* Body */}
      <div className={classes.body}>
        {/* Stories */}
        {stories.length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionLabel}>Stories</div>
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                expanded={expandedStory === story.id}
                onToggle={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                gates={gateResults[story.id]}
              />
            ))}
          </div>
        )}

        {/* Reasoning Log */}
        {reasoningLog.length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionLabel}>Reasoning</div>
            {reasoningLog.slice(-10).map((entry, i) => (
              <div key={i} className={classes.reasoningEntry}>
                <span className={classes.reasoningAction}>{entry.action}: </span>
                {entry.reasoning}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {stories.length === 0 && status === "idle" && (
          <div className={classes.empty}>
            Waiting for loop to start...
          </div>
        )}
      </div>
    </div>
  );
}

function StoryCard({
  story,
  expanded,
  onToggle,
  gates,
}: {
  story: Story;
  expanded: boolean;
  onToggle: () => void;
  gates?: GateResult[];
}) {
  return (
    <div
      className={classes.storyCard}
      data-active={story.status === "in_progress"}
      onClick={onToggle}
    >
      <div className={classes.storyRow}>
        <div className={`${classes.dot} ${DOT_CLASS[story.status]}`} />
        <span className={classes.storyTitle}>{story.title}</span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>

      {!expanded && story.description && (
        <div className={classes.storyDesc}>{story.description}</div>
      )}

      {expanded && (
        <>
          {story.description && (
            <div className={classes.storyDesc} style={{ WebkitLineClamp: "unset" }}>
              {story.description}
            </div>
          )}
          {story.acceptance_criteria && (
            <div className={classes.storyDesc} style={{ WebkitLineClamp: "unset", marginTop: 4 }}>
              <strong>Criteria:</strong> {story.acceptance_criteria}
            </div>
          )}
          {gates && gates.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {gates.map((g, i) => (
                <div key={i} className={classes.gateRow}>
                  {g.passed ? (
                    <CheckCircle size={11} className={classes.gatePass} />
                  ) : (
                    <XCircle size={11} className={classes.gateFail} />
                  )}
                  <span className={classes.gateName}>{g.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: create ArtifactsPane component for loop status in terminal grid"
```

---

### Task 3: Render ArtifactsPane in terminal grid

**Files:**
- Modify: `src/features/terminal/components/TerminalContainer.tsx`

- [ ] **Step 1: Read TerminalContainer.tsx and find where panes render**

Find the section where `TerminalPanel` is rendered for each pane. This is where we add a conditional: if `pane.paneType === "artifacts"`, render `ArtifactsPane` instead.

- [ ] **Step 2: Import ArtifactsPane**

```typescript
import { ArtifactsPane } from "./ArtifactsPane";
```

- [ ] **Step 3: Add conditional rendering**

In the pane rendering section, wrap the TerminalPanel in a conditional:

```tsx
{pane.paneType === "artifacts" ? (
  <ArtifactsPane />
) : (
  <TerminalPanel ... />  // existing code
)}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: render ArtifactsPane in terminal grid for artifacts pane type"
```

---

### Task 4: Auto-create artifacts pane when arbiter session starts

**Files:**
- Modify: `src/stores/sessionStore.ts`

- [ ] **Step 1: Read sessionStore.ts and find the `addSession` action**

- [ ] **Step 2: After placing the session in the layout, auto-split to add artifacts pane**

In `addSession`, after `placeSessionInLayout`, check if the session has `arbiterEnabled`. If so, split the active pane to add an artifacts pane on the right (70/30):

```typescript
addSession: (session: AgentSession) => {
  set((state) => {
    const sessions = [...state.sessions, session];
    const projectSessionIds = getProjectSessionIds(sessions, session.projectId);
    let layout = normalizeLayout(
      state.projectLayouts[session.projectId] ?? createLayout(null),
      projectSessionIds,
      state.activeSessionId,
    );
    layout = placeSessionInLayout(layout, session.id);

    // Auto-create artifacts pane for arbiter sessions
    if (session.arbiterEnabled) {
      const activePaneId = layout.activePaneId;
      const artifactsPane: TerminalPaneLayoutNode = {
        type: "pane",
        id: createNodeId("pane"),
        sessionId: null,
        paneType: "artifacts",
      };
      const currentPane = findPaneById(layout.root, activePaneId);
      if (currentPane) {
        const split = createSplit("row", currentPane, artifactsPane, 0.7);
        layout = {
          ...layout,
          root: replacePane(layout.root, activePaneId, split),
        };
      }
    }

    return {
      sessions,
      activeSessionId: session.id,
      projectLayouts: {
        ...state.projectLayouts,
        [session.projectId]: layout,
      },
    };
  });
  get().persistSessions();
},
```

Note: `createNodeId`, `createSplit`, `findPaneById`, `replacePane` are already defined as helper functions in sessionStore.ts.

The `TerminalPaneLayoutNode` import needs `paneType` — which is already in the type from Task 1.

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: auto-create artifacts pane when arbiter session starts"
```

---

### Task 5: Pass session_id to loop engine

**Files:**
- Modify: `src-tauri/src/loop_engine/engine.rs` (LoopCommand enum + execution)
- Modify: `src-tauri/src/commands/loop_commands.rs` (start_loop command)
- Modify: `src/lib/tauri.ts` (startLoop IPC wrapper)

- [ ] **Step 1: Add session_id to LoopCommand::Start**

In `src-tauri/src/loop_engine/engine.rs`, update:

```rust
pub enum LoopCommand {
    Start {
        project_id: String,
        project_path: String,
        user_request: Option<String>,
        session_id: Option<String>,
    },
    Pause,
    Resume,
    Cancel,
}
```

- [ ] **Step 2: Update the Start arm in run_loop to extract session_id**

Find where `LoopCommand::Start` is pattern-matched and add `session_id` to the destructure. Pass it to `run_loop_lifecycle`.

- [ ] **Step 3: Update run_loop_lifecycle to use session_id**

In `run_loop_lifecycle`, instead of generating `let session_id = format!("loop-{}-{}", project_id, story.id);`, use the provided session_id if available:

```rust
let pty_session_id = if let Some(ref sid) = session_id {
    sid.clone()
} else {
    format!("loop-{}-{}", project_id, story.id)
};
```

Before spawning a new PTY for a story, kill the existing one with the same session_id (if it exists):

```rust
// Kill previous agent in this session before respawning
{
    let mut pm = pty_manager.write().await;
    let _ = pm.kill(&pty_session_id); // ignore error if not found
}
```

Then use `pty_session_id` for spawning.

- [ ] **Step 4: Update start_loop command**

In `src-tauri/src/commands/loop_commands.rs`, add `session_id: Option<String>` parameter:

```rust
#[tauri::command]
pub async fn start_loop(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    user_request: Option<String>,
    session_id: Option<String>,
) -> Result<(), AppError> {
    state.loop_cmd_tx
        .send(LoopCommand::Start { project_id, project_path, user_request, session_id })
        .await
        .map_err(|e| AppError::Channel(e.to_string()))
}
```

- [ ] **Step 5: Update IPC wrapper**

In `src/lib/tauri.ts`, update `startLoop`:

```typescript
export async function startLoop(
  projectId: string,
  projectPath: string,
  userRequest?: string,
  sessionId?: string,
): Promise<void> {
  return invoke("start_loop", {
    projectId,
    projectPath,
    userRequest: userRequest ?? null,
    sessionId: sessionId ?? null,
  });
}
```

- [ ] **Step 6: Pass session_id from NewAgentDialog**

In `src/features/agents/components/NewAgentDialog.tsx`, update the `startLoop` call to pass the session ID:

```typescript
await startLoop(projectId, project.path, initialPromptText.trim(), session.id);
```

- [ ] **Step 7: Verify build**

Run: `cd src-tauri && cargo check && cd .. && pnpm build`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: pass session_id to loop engine for PTY reuse"
```

---

### Task 6: Remove Loop panel and floating preview

**Files:**
- Delete: `src/features/loop/components/LoopPanel.tsx`
- Delete: `src/features/loop/components/LoopControls.tsx`
- Delete: `src/features/loop/components/LoopFloatingPreview.tsx`
- Delete: `src/features/loop/components/LoopProgress.tsx`
- Delete: `src/features/loop/components/LoopConsolePreview.tsx`
- Delete: `src/features/loop/components/ArbiterReasoningLog.tsx`
- Delete: `src/features/loop/components/LoopPanel.module.css`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Remove loop panel from App.tsx**

Remove these imports and their rendered elements:
- `LoopPanel` import and its `<div>` block (always-mounted with CSS hiding)
- `LoopFloatingPreview` import and its `<LoopFloatingPreview />` element
- Keep `initLoopListener` — the event subscription is still needed for the artifacts pane

- [ ] **Step 2: Remove "loop" from sidebar navigation**

In `src/components/layout/Sidebar.tsx`, find the `navItems` array and remove the `{ id: "loop", ... }` entry.

- [ ] **Step 3: Remove "loop" from activePanel type**

In `src/stores/uiStore.ts`, remove `"loop"` from the `activePanel` type union if it's defined there. If the type is inferred, just ensure no code references `activePanel === "loop"`.

- [ ] **Step 4: Delete loop component files**

```bash
rm src/features/loop/components/LoopPanel.tsx
rm src/features/loop/components/LoopControls.tsx
rm src/features/loop/components/LoopFloatingPreview.tsx
rm src/features/loop/components/LoopProgress.tsx
rm src/features/loop/components/LoopConsolePreview.tsx
rm src/features/loop/components/ArbiterReasoningLog.tsx
rm src/features/loop/components/LoopPanel.module.css
```

Keep `StoryList.tsx` if it's reused by ArtifactsPane, otherwise delete it too.

- [ ] **Step 5: Fix any import errors**

Run `pnpm build` and fix any remaining references to deleted files. The `loopStore.ts` should remain — ArtifactsPane uses it.

- [ ] **Step 6: Verify build**

Run: `pnpm build`

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor: remove standalone Loop panel, move to artifacts pane in terminal"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd src-tauri && cargo test && cd .. && pnpm test
```

- [ ] **Step 2: Full build**

```bash
pnpm build && cd src-tauri && cargo build
```

- [ ] **Step 3: Commit any fixes**
