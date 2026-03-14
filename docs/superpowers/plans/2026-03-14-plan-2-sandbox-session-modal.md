# Sandbox Decoupling & Session Modal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple sandbox from arbiter into a per-session opt-in toggle, and redesign the new session modal with arbiter loop options and max iterations slider.

**Architecture:** Cache sandbox capabilities in settingsStore on app startup. Add sandbox toggle + arbiter toggle + max iterations slider to NewAgentDialog. When arbiter+loop session starts, set max_iterations and send LoopCommand::Start. Store `sandboxed` flag on AgentSession.

**Tech Stack:** React (Mantine Slider, Switch), Zustand, Tauri IPC

---

### Task 1: Cache sandbox capabilities on app startup

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add sandbox capabilities to settingsStore**

Read `src/stores/settingsStore.ts`. Add to the state interface:

```typescript
sandboxAvailable: boolean;
sandboxPlatform: string;
loadSandboxCapabilities: () => Promise<void>;
```

Add to the store:

```typescript
sandboxAvailable: false,
sandboxPlatform: "",

loadSandboxCapabilities: async () => {
  try {
    const caps = await getSandboxCapabilities();
    set({ sandboxAvailable: caps.available, sandboxPlatform: caps.platform });
  } catch {
    set({ sandboxAvailable: false, sandboxPlatform: "" });
  }
},
```

Import `getSandboxCapabilities` from `@/lib/tauri`.

- [ ] **Step 2: Call on app startup in App.tsx**

In `src/App.tsx`, add `loadSandboxCapabilities` to the destructure from `useSettingsStore`, and call it in the existing startup `useEffect`:

```typescript
const { loadSettings, loadSandboxCapabilities } = useSettingsStore();

useEffect(() => {
  loadProjects();
  loadSettings();
  loadSandboxCapabilities();
  loadPersistedSessions();
}, [loadProjects, loadSettings, loadSandboxCapabilities, loadPersistedSessions]);
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: cache sandbox capabilities on app startup"
```

---

### Task 2: Add sandbox and arbiter fields to AgentSession type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add fields to AgentSession interface**

```typescript
sandboxed?: boolean;
arbiterEnabled?: boolean;
maxIterations?: number;
```

These are optional to avoid breaking existing session creation code.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add sandboxed, arbiterEnabled, maxIterations to AgentSession"
```

---

### Task 3: Redesign NewAgentDialog with sandbox + arbiter toggles

**Files:**
- Modify: `src/features/agents/components/NewAgentDialog.tsx`

- [ ] **Step 1: Add new state variables**

After existing `useState` declarations, add:

```typescript
const [sandboxed, setSandboxed] = useState(false);
const [arbiterEnabled, setArbiterEnabled] = useState(false);
const [maxIterations, setMaxIterations] = useState(10);
const [initialPromptText, setInitialPromptText] = useState(initialPrompt ?? "");
```

Import from settingsStore:

```typescript
const { sandboxAvailable } = useSettingsStore();
```

- [ ] **Step 2: Add initial prompt textarea**

After the Label TextInput and before the YOLO section, add:

```tsx
<Textarea
  label={
    <>
      Initial prompt{" "}
      <Text component="span" size="xs" c="var(--text-secondary)" fw={400}>
        {arbiterEnabled ? "(required for loop)" : "(optional)"}
      </Text>
    </>
  }
  value={initialPromptText}
  onChange={(e) => setInitialPromptText(e.target.value)}
  placeholder="What should the agent work on?"
  minRows={2}
  maxRows={4}
  autosize
  styles={INPUT_STYLES}
/>
```

Import `Textarea` from `@mantine/core`.

- [ ] **Step 3: Add sandbox toggle after YOLO section**

Only visible when `sandboxAvailable` is true and agent is not terminal:

```tsx
{sandboxAvailable && agentType !== "terminal" && (
  <Group justify="space-between">
    <Group gap="xs">
      <Shield size={14} color="var(--text-secondary)" />
      <SectionTitle mb={0}>Isolated Environment</SectionTitle>
    </Group>
    <Switch
      checked={sandboxed}
      onChange={(e) => setSandboxed(e.currentTarget.checked)}
      styles={{
        track: {
          backgroundColor: sandboxed ? undefined : "var(--bg-tertiary)",
          borderColor: "var(--bg-tertiary)",
        },
      }}
    />
  </Group>
)}
```

Import `Shield` from `lucide-react`.

- [ ] **Step 4: Add arbiter session toggle with loop options**

After the sandbox toggle:

```tsx
{agentType !== "terminal" && (
  <Stack gap="xs">
    <Group justify="space-between">
      <SectionTitle mb={0}>Arbiter Session</SectionTitle>
      <Switch
        checked={arbiterEnabled}
        onChange={(e) => setArbiterEnabled(e.currentTarget.checked)}
        color="cyan"
        styles={{
          track: {
            backgroundColor: arbiterEnabled ? undefined : "var(--bg-tertiary)",
            borderColor: "var(--bg-tertiary)",
          },
        }}
      />
    </Group>

    {arbiterEnabled && (
      <Stack gap="xs" pl="xs" style={{ borderLeft: "2px solid var(--border)" }}>
        <Group justify="space-between" align="center">
          <Text size="xs" c="var(--text-secondary)">Max loops</Text>
          <Group gap="xs" align="center">
            <Slider
              value={maxIterations}
              onChange={setMaxIterations}
              min={1}
              max={50}
              step={1}
              style={{ width: 120 }}
              color="cyan"
              size="xs"
              styles={{
                track: { backgroundColor: "var(--bg-tertiary)" },
              }}
            />
            <NumberInput
              value={maxIterations}
              onChange={(val) => setMaxIterations(typeof val === "number" ? Math.max(1, Math.min(50, val)) : 10)}
              min={1}
              max={50}
              step={1}
              size="xs"
              style={{ width: 60 }}
              styles={INPUT_STYLES}
              hideControls
            />
          </Group>
        </Group>
        <Text size="xs" c="var(--text-tertiary)">
          Each loop iteration uses one CLI session. Higher values increase token usage.
        </Text>
      </Stack>
    )}
  </Stack>
)}
```

Import `Slider` and `NumberInput` from `@mantine/core`.

- [ ] **Step 5: Update handleStart to include new fields**

Update the session creation and add loop start logic:

```typescript
const handleStart = async () => {
  if (!projectId) return;
  if (arbiterEnabled && !initialPromptText.trim()) return;
  setLoading(true);

  const agentDef = agentDefs.find((d) => d.agent_type === agentType);
  const sessionLabel =
    label.trim() ||
    `${agentDef?.display_name ?? agentType} #${Date.now().toString(36).slice(-4)}`;

  const session: AgentSession = {
    id: uuidv4(),
    projectId,
    agentType,
    status: "starting",
    yoloMode,
    createdAt: new Date().toISOString(),
    label: sessionLabel,
    isResumed: false,
    sandboxed,
    arbiterEnabled,
    maxIterations: arbiterEnabled ? maxIterations : undefined,
    ...(initialPromptText.trim() ? { initialPrompt: initialPromptText.trim() } : {}),
  };

  addSession(session);
  setActivePanel("terminal");

  // If arbiter loop enabled, set max iterations and start the loop
  if (arbiterEnabled) {
    try {
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
      if (project) {
        await setMaxIterations(projectId, maxIterations);
        await startLoop(projectId, project.path, initialPromptText.trim());
      }
    } catch (err) {
      console.error("Failed to start arbiter loop:", err);
    }
  }

  setLoading(false);
  onClose();
};
```

Import `setMaxIterations`, `startLoop` from `@/lib/tauri` and `useProjectStore` from `@/stores/projectStore`.

- [ ] **Step 6: Add validation — disable Start button when arbiter is on but prompt empty**

Update the disabled condition on the Start button:

```tsx
disabled={loading || !projectId || (arbiterEnabled && !initialPromptText.trim())}
```

- [ ] **Step 7: Verify build**

Run: `pnpm build`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: redesign session modal with sandbox toggle and arbiter loop options"
```

---

### Task 4: Pass sandboxed flag through to PTY spawn

**Files:**
- Modify: `src/features/terminal/components/TerminalPanel.tsx`

- [ ] **Step 1: Read TerminalPanel.tsx to find where spawnPty is called**

Find the `spawnPty` call and check what parameters it passes for `sandbox_enabled` and `trust_level`.

- [ ] **Step 2: Use the session's `sandboxed` flag instead of project arbiter_enabled**

Currently it likely reads `project.arbiter_enabled` to decide sandboxing. Change it to read `session.sandboxed` instead:

```typescript
const sandboxEnabled = session.sandboxed ?? false;
```

For trust level, use the project's trust level if available, else default to 2:

```typescript
const trustLevel = arbiterState?.trust_level ?? 2;
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: use per-session sandboxed flag for PTY spawn"
```

---

### Task 5: Add shield icon to sandboxed sessions in sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Find where sessions are rendered in Sidebar.tsx**

Look for the session list rendering (likely mapping over sessions).

- [ ] **Step 2: Add shield icon next to session label when sandboxed**

```tsx
{session.sandboxed && <Shield size={11} color="var(--text-secondary)" />}
```

Import `Shield` from `lucide-react` if not already imported.

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: show shield icon on sandboxed sessions in sidebar"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd src-tauri && cargo test && cd .. && pnpm test
```

- [ ] **Step 2: Full build**

```bash
pnpm build && cd src-tauri && cargo build
```

- [ ] **Step 3: Commit any fixes**
