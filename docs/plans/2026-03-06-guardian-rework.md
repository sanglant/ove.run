# Guardian Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework guardian from a spawned CLI agent session to a lightweight background `claude -p` call that answers agent questions when the user doesn't respond within a configurable timeout.

**Architecture:** Remove all guardian session infrastructure (spawn, crash handling, review queue, output buffers). Replace with a single `guardianAnswer()` function called when the feedback modal timer expires. It builds a prompt from terminal output + parsed options + project knowledge, calls `claude -p`, parses the response, and sends keystrokes. Knowledge is gathered lazily on first invocation per project.

**Tech Stack:** Tauri 2 (Rust backend), React + TypeScript frontend, Zustand state, Mantine UI

---

### Task 1: Add `guardian_timeout_seconds` to backend settings

**Files:**
- Modify: `src-tauri/src/state.rs:79-86` (GlobalSettings struct)

**Step 1: Add field to GlobalSettings**

In `src-tauri/src/state.rs`, add `guardian_timeout_seconds` to `GlobalSettings`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub notifications_enabled: bool,
    pub minimize_to_tray: bool,
    pub terminal_scrollback: u32,
    #[serde(default = "default_guardian_timeout")]
    pub guardian_timeout_seconds: u32,
}

fn default_guardian_timeout() -> u32 {
    20
}
```

**Step 2: Update Default impl**

In the `impl Default for AppSettings` block, add `guardian_timeout_seconds: 20` to `GlobalSettings`.

**Step 3: Remove `is_guardian` from PersistedSession**

In `src-tauri/src/sessions/store.rs`, remove the `is_guardian: bool` field from `PersistedSession`.

**Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: successful build (fix any compile errors from removed field)

**Step 5: Commit**

```
feat: add guardian_timeout_seconds to settings, remove is_guardian from persisted sessions
```

---

### Task 2: Update frontend types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add `guardian_timeout_seconds` to `GlobalSettings`**

```typescript
export interface GlobalSettings {
  theme: string;
  font_family: string;
  font_size: number;
  notifications_enabled: boolean;
  minimize_to_tray: boolean;
  terminal_scrollback: number;
  guardian_timeout_seconds: number;
}
```

**Step 2: Remove `isGuardian` from `AgentSession`**

Remove the `isGuardian: boolean;` line from the `AgentSession` interface.

**Step 3: Remove `is_guardian` from `PersistedSession`**

Remove the `is_guardian: boolean;` line from the `PersistedSession` interface.

**Step 4: Remove `ReviewRequest` type**

Delete the entire `ReviewRequest` interface.

**Step 5: Remove `NotificationAction` type**

Delete the `NotificationAction` interface and remove `actions?: NotificationAction[]` from `NotificationItem`.

**Step 6: Commit**

```
refactor: remove isGuardian, ReviewRequest, NotificationAction from types
```

---

### Task 3: Simplify guardianStore

**Files:**
- Modify: `src/stores/guardianStore.ts`

**Step 1: Rewrite to minimal store**

Replace entire file with:

```typescript
import { create } from "zustand";

interface GuardianState {
  /** Tracks which projects have had guardian knowledge generated */
  guardianInitialized: Record<string, boolean>;
  setGuardianInitialized: (projectId: string, initialized: boolean) => void;
  clearProjectGuardianState: (projectId: string) => void;
}

export const useGuardianStore = create<GuardianState>((set) => ({
  guardianInitialized: {},

  setGuardianInitialized: (projectId: string, initialized: boolean) => {
    set((state) => ({
      guardianInitialized: { ...state.guardianInitialized, [projectId]: initialized },
    }));
  },

  clearProjectGuardianState: (projectId: string) => {
    set((state) => {
      const guardianInitialized = { ...state.guardianInitialized };
      delete guardianInitialized[projectId];
      return { guardianInitialized };
    });
  },
}));
```

**Step 2: Commit**

```
refactor: simplify guardianStore to only track initialization state
```

---

### Task 4: Rewrite guardian.ts

**Files:**
- Modify: `src/lib/guardian.ts`

**Step 1: Replace entire file**

Remove all existing code. Write the new `guardianAnswer()` function:

```typescript
import { v4 as uuidv4 } from "uuid";
import { useGuardianStore } from "@/stores/guardianStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { guardianReview, listKnowledge, readKnowledgeContent, createKnowledge } from "@/lib/tauri";
import { writePty } from "@/lib/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { stripAnsi } from "@/lib/patterns";
import type { FeedbackItem, ParsedOption } from "@/types";

function compactText(text: string, maxLen: number): string {
  return stripAnsi(text)
    .replace(/\r\n|\r|\n/g, " | ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function guardianAnswer(
  item: FeedbackItem,
  projectPath: string,
): Promise<void> {
  const { projectId, sessionId, output, parsedOptions, allowFreeInput } = item;

  // Load existing guardian knowledge
  let knowledgeNotes = "";
  const hasKnowledge = useGuardianStore.getState().guardianInitialized[projectId];
  if (hasKnowledge) {
    try {
      const entries = await listKnowledge(projectId);
      const guardianEntry = entries.find((e) => e.name === "Guardian Notes");
      if (guardianEntry) {
        knowledgeNotes = await readKnowledgeContent(projectId, guardianEntry.id);
      }
    } catch {
      // proceed without knowledge
    }
  }

  const compactOutput = compactText(output, 1500);
  const optionLabels = parsedOptions.map((o) => o.label).join(", ");

  const knowledgeSection = knowledgeNotes
    ? `Project knowledge: ${compactText(knowledgeNotes, 800)}`
    : "No project notes yet — after answering, also provide brief project notes.";

  const prompt =
    `You are a Guardian agent reviewing an AI coding agent's question on a software project. ` +
    `${knowledgeSection} ` +
    `Agent terminal output: ${compactOutput}. ` +
    `Available options: ${optionLabels || "(none)"}. ` +
    `Free text input allowed: ${allowFreeInput ? "yes" : "no"}. ` +
    `Pick the best option for this project. Respond with:\n` +
    `ANSWER: {exact option label}\n` +
    `or if free text is needed:\n` +
    `ANSWER_TEXT: {your response}\n` +
    `REASONING: {1-2 sentence explanation}\n` +
    (knowledgeNotes ? "" : `PROJECT_NOTES: {brief project summary, tech stack, key conventions for future reference}\n`);

  try {
    const response = await guardianReview(prompt, projectPath);
    const result = parseGuardianResponse(response, parsedOptions);

    if (result.answer) {
      // Find matching option and send its keys
      const option = parsedOptions.find(
        (o) => o.label.toLowerCase() === result.answer!.toLowerCase(),
      );
      if (option) {
        await sendKeys(sessionId, option.keys);
      } else if (allowFreeInput) {
        // Option not found, send as free text
        await sendText(sessionId, result.answer);
      }
    } else if (result.answerText && allowFreeInput) {
      await sendText(sessionId, result.answerText);
    } else if (parsedOptions.length > 0) {
      // Fallback: pick first option
      await sendKeys(sessionId, parsedOptions[0].keys);
    }

    // Update session status
    useSessionStore.getState().updateSessionStatus(sessionId, "working");

    // Save project notes if provided
    if (result.projectNotes && !knowledgeNotes) {
      try {
        await createKnowledge(projectId, "Guardian Notes", "notes", result.projectNotes);
        useGuardianStore.getState().setGuardianInitialized(projectId, true);
      } catch {
        // non-critical
      }
    }

    // Notification
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
    const choiceLabel = result.answer || result.answerText || "first option";
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Answered",
      body: `${session?.label ?? "Session"}: ${choiceLabel} — ${result.reasoning ?? ""}`.slice(0, 300),
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Guardian answer failed:", err);
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Error",
      body: `Failed to auto-answer: ${String(err).slice(0, 200)}`,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

interface GuardianResult {
  answer?: string;
  answerText?: string;
  reasoning?: string;
  projectNotes?: string;
}

function parseGuardianResponse(response: string, options: ParsedOption[]): GuardianResult {
  const result: GuardianResult = {};

  const answerMatch = response.match(/^ANSWER:\s*(.+)$/m);
  if (answerMatch) result.answer = answerMatch[1].trim();

  const answerTextMatch = response.match(/^ANSWER_TEXT:\s*(.+)$/m);
  if (answerTextMatch) result.answerText = answerTextMatch[1].trim();

  const reasoningMatch = response.match(/^REASONING:\s*(.+)$/m);
  if (reasoningMatch) result.reasoning = reasoningMatch[1].trim();

  const notesMatch = response.match(/^PROJECT_NOTES:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/m);
  if (notesMatch) result.projectNotes = notesMatch[1].trim();

  return result;
}

async function sendKeys(sessionId: string, keys: number[]): Promise<void> {
  const keypresses: number[][] = [];
  let i = 0;
  while (i < keys.length) {
    if (keys[i] === 0x1b && keys[i + 1] === 0x5b && i + 2 < keys.length) {
      keypresses.push(keys.slice(i, i + 3));
      i += 3;
    } else {
      keypresses.push([keys[i]]);
      i += 1;
    }
  }
  for (let k = 0; k < keypresses.length; k++) {
    await writePty(sessionId, keypresses[k]);
    if (k < keypresses.length - 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function sendText(sessionId: string, text: string): Promise<void> {
  const bytes = Array.from(new TextEncoder().encode(text + "\r"));
  await sendKeys(sessionId, bytes);
}
```

**Step 2: Commit**

```
feat: rewrite guardian as background answer function with lazy knowledge
```

---

### Task 5: Update AgentFeedbackModal

**Files:**
- Modify: `src/features/guardian/components/AgentFeedbackModal.tsx`

**Step 1: Replace guardian timer logic**

Key changes:
- Import `guardianAnswer` instead of `triggerGuardianReview`
- Import `useSettingsStore` for timeout value
- Remove `useGuardianStore` import
- Use `settings.global.guardian_timeout_seconds * 1000` instead of `GUARDIAN_TIMEOUT_MS`
- Remove the hardcoded `GUARDIAN_TIMEOUT_MS` constant
- On timer expiry, call `guardianAnswer(item, projectPath)` and `onDismiss()`
- Remove `session?.isGuardian` check in modal title (no more guardian sessions)

The timer effect should:
1. Get `guardian_timeout_seconds` from settings
2. Count down
3. On expiry: call `guardianAnswer(item, projectPath)` then `onDismiss()`

**Step 2: Commit**

```
feat: connect feedback modal to guardian answer with configurable timeout
```

---

### Task 6: Remove isGuardian from sessionStore and session creation sites

**Files:**
- Modify: `src/stores/sessionStore.ts`
- Modify: `src/features/agents/components/NewAgentDialog.tsx`

**Step 1: Remove isGuardian from sessionStore**

In `persistSessions()`: remove `is_guardian: s.isGuardian` from the mapped object.
In `loadPersistedSessions()`: remove `isGuardian: p.is_guardian` from the mapped object.

**Step 2: Remove isGuardian from NewAgentDialog**

In `NewAgentDialog.tsx`, remove `isGuardian: false` from the session creation object.

**Step 3: Commit**

```
refactor: remove isGuardian from session store and creation sites
```

---

### Task 7: Clean up Sidebar guardian toggle

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Simplify guardian toggle**

The guardian toggle button in the sidebar should now just toggle `project.guardian_enabled` — no more spawning/tearing down guardian sessions.

Replace `handleGuardianToggle`:
```typescript
const handleGuardianToggle = async (e: React.MouseEvent, project: Project) => {
  e.stopPropagation();
  const newEnabled = !project.guardian_enabled;
  await updateProject({ ...project, guardian_enabled: newEnabled });
};
```

Remove imports: `useGuardianStore`, `spawnGuardianSession`, `teardownGuardian`.
Change the guardian button's active check from `!!guardianSessionIds[project.id]` to `project.guardian_enabled`.
Remove `guardianSessionIds` variable.
Remove `isGuardian` checks in session list rendering — just show agent icon for all sessions.
Remove `!session.isGuardian` check on YOLO badge.

**Step 2: Commit**

```
refactor: simplify sidebar guardian toggle to just update project setting
```

---

### Task 8: Clean up TopBar

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

**Step 1: Remove guardian references**

- Remove `useGuardianStore` import and `guardianSessionIds` variable
- Remove `Shield` icon import
- Remove `projectHasGuardian` variable
- Remove guardian badge (`activeSession.isGuardian` block)
- Remove shield indicator (`projectHasGuardian && !activeSession.isGuardian` block)
- Remove `!activeSession.isGuardian` from YOLO toggle condition (keep `activeSession.agentType !== "terminal"`)

**Step 2: Commit**

```
refactor: remove guardian session references from TopBar
```

---

### Task 9: Clean up TerminalPanel

**Files:**
- Modify: `src/features/terminal/components/TerminalPanel.tsx`

**Step 1: Remove guardian-specific code**

- Remove `useGuardianStore` import and all `guardianStore` usage (output buffer tracking)
- Remove `handleGuardianCrash` import
- Remove `appendToTerminalBuffer` from feedbackParser import
- Remove the output buffer update block inside the `pty-output` listener (the `guardianState.updateOutputBuffer` calls)
- Remove `!session.isGuardian` check around feedback enqueueing — always enqueue
- Remove `session.isGuardian` check in pty-exit handler — always show exit message and update status

**Step 2: Commit**

```
refactor: remove guardian buffer tracking and isGuardian checks from TerminalPanel
```

---

### Task 10: Clean up TerminalTabs

**Files:**
- Modify: `src/features/terminal/components/TerminalTabs.tsx`

**Step 1: Remove guardian references**

- Remove `Shield` from lucide imports
- Remove `teardownGuardian` import
- In `handleClose`: remove the `session.isGuardian` branch — just kill PTY and remove session
- In `handleKillActive`: remove the `active.isGuardian` branch — just kill PTY and remove session
- In `SessionTab`: remove `session.isGuardian` ternary — always show agent icon
- In `FlatTabs` render: remove `session.isGuardian` ternary — always show agent label

**Step 2: Commit**

```
refactor: remove guardian session handling from TerminalTabs
```

---

### Task 11: Add guardian timeout to Settings modal

**Files:**
- Modify: `src/features/settings/components/SettingsModal.tsx`
- Modify: `src/stores/settingsStore.ts`

**Step 1: Update default settings**

In `settingsStore.ts`, add `guardian_timeout_seconds: 20` to `DEFAULT_SETTINGS.global`.

**Step 2: Add setting to modal**

In `SettingsModal.tsx`, add a `NumberInput` for guardian timeout after the "Minimize to Tray" toggle:

```tsx
{/* Guardian timeout */}
<Group justify="space-between" align="center">
  <div>
    <Text size="sm" style={{ color: "var(--text-primary)" }}>
      Guardian Timeout
    </Text>
    <Text size="xs" style={{ color: "var(--text-secondary)", marginTop: "2px" }}>
      Seconds before guardian auto-answers
    </Text>
  </div>
  <NumberInput
    min={5}
    max={120}
    value={draft.global.guardian_timeout_seconds}
    onChange={(val) =>
      handleGlobalChange(
        "guardian_timeout_seconds",
        typeof val === "number" ? val : parseInt(String(val), 10),
      )
    }
    style={{ width: "80px" }}
    styles={inputStyles}
  />
</Group>
```

**Step 3: Commit**

```
feat: add guardian timeout setting to settings modal
```

---

### Task 12: Remove NotificationCenter guardian action handling

**Files:**
- Modify: `src/features/notifications/components/NotificationCenter.tsx`

**Step 1: Check and remove action handling**

Check if `NotificationCenter.tsx` has any handling for `NotificationAction` (approve_override, view_guardian actions). Remove those since `NotificationAction` type is deleted. Keep basic notification rendering.

**Step 2: Commit**

```
refactor: remove guardian action handling from NotificationCenter
```

---

### Task 13: Final verification

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 2: Rust check**

Run: `cd src-tauri && cargo build`
Expected: successful build

**Step 3: Final commit with any fixes**

If any compilation issues, fix them and commit.
