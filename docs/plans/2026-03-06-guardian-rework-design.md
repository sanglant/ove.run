# Guardian Rework Design

## Summary

Rework the guardian feature from a spawned CLI agent session to a lightweight background `claude -p` call that answers agent questions when the user doesn't respond within a configurable timeout.

## Architecture

### Current State
- Guardian spawns a full CLI agent session (visible in tabs)
- Maintains review queue, output buffers, crash handling
- Reviews git diffs and agent output for safety (approve/reject)

### New State
- Guardian is a background function, no session/tab
- Triggered only when feedback modal timer expires
- Runs `claude -p` to pick the best answer for the agent's question
- Uses project knowledge notes for context (lazy + incremental)

## Flow

1. Agent hits `needs_input` → feedback modal appears with timer (configurable, default 20s)
2. User responds before timer → guardian not involved
3. Timer expires → `guardianAnswer()`:
   - Load existing project knowledge notes (if any)
   - Build prompt: terminal output + available options + knowledge
   - Call `claude -p`
   - Parse response → pick option or send free text
   - Send keystrokes to PTY
   - Fire notification: "Guardian answered: [choice] — [reasoning]"
   - If no knowledge exists, prompt also asks for project notes → save to knowledge store

## Guardian Answer Prompt

```
You are a Guardian reviewing an AI coding agent's question.
Project knowledge: {knowledgeNotes or "No notes yet — after answering, also provide project notes."}
Agent terminal output: {cleanedOutput}
Available options: {options as labels}
Free text allowed: {yes/no}

Pick the best option for this project. Respond with:
ANSWER: {exact option label}  OR  ANSWER_TEXT: {free text response}
REASONING: {1-2 sentence explanation}
{If no project notes exist: PROJECT_NOTES: {brief project summary for future reference}}
```

## Settings

- Add `guardian_timeout_seconds: number` (default 20) to `GlobalSettings`
- Configurable in settings modal
- Remove hardcoded `GUARDIAN_TIMEOUT_MS`

## Removals

- `spawnGuardianSession()`, `teardownGuardian()`, `handleGuardianCrash()`
- `isGuardian` from `AgentSession` / `PersistedSession`
- `ReviewRequest` type and review queue
- Guardian output buffer tracking in `TerminalPanel`
- Guardian session spawning in Sidebar
- Most of `guardianStore` (keep only `guardianInitialized`)

## Files to Change

1. `src/types/index.ts` — remove `ReviewRequest`, `NotificationAction`, `isGuardian`; add `guardian_timeout_seconds`
2. `src-tauri/src/state.rs` — add `guardian_timeout_seconds` to settings, remove `is_guardian` from persisted session
3. `src-tauri/src/settings/store.rs` — default value for `guardian_timeout_seconds`
4. `src/lib/guardian.ts` — rewrite: remove session spawning, add `guardianAnswer()`
5. `src/stores/guardianStore.ts` — simplify to just `guardianInitialized` tracking
6. `src/features/guardian/components/AgentFeedbackModal.tsx` — call `guardianAnswer()` on timeout
7. `src/stores/sessionStore.ts` — remove `isGuardian` references
8. `src/components/layout/Sidebar.tsx` — remove guardian session spawning
9. `src/features/terminal/components/TerminalPanel.tsx` — remove guardian buffer tracking, `isGuardian` checks
10. `src-tauri/src/sessions/store.rs` — remove `is_guardian` from `PersistedSession`
11. Settings modal — add guardian timeout field
