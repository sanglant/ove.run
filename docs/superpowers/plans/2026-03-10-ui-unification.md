# UI Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared constants and reusable UI components to eliminate duplication across the codebase.

**Architecture:** Create `src/constants/` for shared data (agent metadata, status colors, Mantine style objects) and populate `src/components/ui/` with small, stateless components (SectionTitle, AgentBadge, StatusDot, EmptyState, ModalFooter). Each consumer is updated to import from the shared location instead of defining its own copy.

**Tech Stack:** React, Mantine v7, CSS Modules, TypeScript

---

## Task 1: Shared Constants — `src/constants/agents.ts`

**Files:**
- Create: `src/constants/agents.ts`
- Modify: `src/components/layout/Sidebar.tsx` (remove lines 33-48: `STATUS_COLORS`, `AGENT_ICON`)
- Modify: `src/features/terminal/components/TerminalTabs.tsx` (remove lines 22-45: `STATUS_COLORS`, `AGENT_LABEL`, `AGENT_COLOR`)
- Modify: `src/components/layout/TopBar.tsx` (remove lines 8-17: `STATUS_LABELS`, `AGENT_DISPLAY_NAMES`)
- Modify: `src/features/guardian/components/AgentFeedbackModal.tsx` (remove lines 28-34: `AGENT_META`)
- Modify: `src/features/agents/components/NewAgentDialog.tsx` (remove lines 151-157: `AGENT_META`)
- Modify: `src/components/layout/StatusBar.tsx` (remove lines 19-26: `STATUS_COLORS`)

- [ ] **Step 1: Create `src/constants/agents.ts`**

```ts
import type { AgentStatus } from "@/types";

export interface AgentMeta {
  label: string;
  color: string;
  displayName: string;
}

export interface StatusMeta {
  label: string;
  color: string;
  className?: string;
}

export const AGENT_META: Record<string, AgentMeta> = {
  claude:   { label: "CC", color: "var(--claude)",         displayName: "Claude" },
  gemini:   { label: "GC", color: "var(--gemini)",         displayName: "Gemini" },
  copilot:  { label: "CP", color: "var(--copilot)",        displayName: "Copilot" },
  codex:    { label: "CX", color: "var(--codex)",          displayName: "Codex" },
  terminal: { label: ">_", color: "var(--text-secondary)", displayName: "Terminal" },
};

export const STATUS_META: Record<string, StatusMeta> = {
  starting:    { label: "Starting",    color: "var(--warning)" },
  idle:        { label: "Idle",        color: "var(--text-secondary)" },
  working:     { label: "Working",     color: "var(--accent)",   className: "animate-pulse-glow" },
  needs_input: { label: "Needs Input", color: "var(--warning)",  className: "animate-status-pulse" },
  finished:    { label: "Finished",    color: "var(--success)" },
  error:       { label: "Error",       color: "var(--danger)" },
};

/** Ordered for display in status bar */
export const STATUS_ORDER: AgentStatus[] = [
  "working",
  "needs_input",
  "starting",
  "idle",
  "error",
  "finished",
];

export function getAgentMeta(agentType: string): AgentMeta {
  return AGENT_META[agentType] ?? { label: "?", color: "var(--text-secondary)", displayName: agentType };
}

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, color: "var(--text-secondary)" };
}
```

- [ ] **Step 2: Update `Sidebar.tsx`**

Remove local `STATUS_COLORS` (lines 33-40) and `AGENT_ICON` (lines 42-48). Add import:
```ts
import { AGENT_META, STATUS_META, getAgentMeta, getStatusMeta } from "@/constants/agents";
```

Replace usages:
- `STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" }` → `getStatusMeta(session.status)` (note: `bg` becomes `color`)
- `AGENT_ICON[session.agentType]` → `getAgentMeta(session.agentType)`
- `statusColor.bg` → `statusMeta.color`
- `agentIcon?.color` → `agentMeta.color`
- `agentIcon?.label` → `agentMeta.label`

- [ ] **Step 3: Update `TerminalTabs.tsx`**

Remove local `STATUS_COLORS` (lines 22-29), `AGENT_LABEL` (lines 31-37), `AGENT_COLOR` (lines 39-45). Add import:
```ts
import { AGENT_META, getAgentMeta, getStatusMeta } from "@/constants/agents";
```

Replace usages:
- `STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" }` → `getStatusMeta(session.status)`
- `statusColor.bg` → `statusMeta.color`
- `AGENT_LABEL[session.agentType] ?? "?"` → `getAgentMeta(session.agentType).label`
- `AGENT_COLOR[session.agentType] ?? "var(--accent)"` → `getAgentMeta(session.agentType).color`

- [ ] **Step 4: Update `TopBar.tsx`**

Remove local `STATUS_LABELS` (lines 8-15) and `AGENT_DISPLAY_NAMES` (line 17). Add import:
```ts
import { getAgentMeta, getStatusMeta } from "@/constants/agents";
```

Replace:
- `STATUS_LABELS[activeSession.status] ?? {...}` → `getStatusMeta(activeSession.status)`
- `AGENT_DISPLAY_NAMES[activeSession.agentType] || activeSession.agentType` → `getAgentMeta(activeSession.agentType).displayName`

- [ ] **Step 5: Update `AgentFeedbackModal.tsx`**

Remove local `AGENT_META` (lines 28-34). Add import:
```ts
import { getAgentMeta } from "@/constants/agents";
```

Replace:
- `AGENT_META[session?.agentType ?? ""] ?? AGENT_META.claude` → `getAgentMeta(session?.agentType ?? "")`

- [ ] **Step 6: Update `NewAgentDialog.tsx`**

Remove local `AGENT_META` (lines 151-157). Add import:
```ts
import { getAgentMeta } from "@/constants/agents";
```

Replace:
- `AGENT_META[def.agent_type] ?? { label: "?", color: "var(--text-secondary)" }` → `getAgentMeta(def.agent_type)`

- [ ] **Step 7: Update `StatusBar.tsx`**

Remove local `STATUS_COLORS` (lines 19-26) and `STATUS_ORDER` (lines 10-17). Add import:
```ts
import { STATUS_META, STATUS_ORDER } from "@/constants/agents";
```

Replace:
- `STATUS_COLORS[status]` → `STATUS_META[status].color`

- [ ] **Step 8: Verify and commit**

Run: `npx tsc --noEmit`
Expected: No errors.

```bash
git add src/constants/agents.ts src/components/layout/Sidebar.tsx src/components/layout/TopBar.tsx src/components/layout/StatusBar.tsx src/features/terminal/components/TerminalTabs.tsx src/features/guardian/components/AgentFeedbackModal.tsx src/features/agents/components/NewAgentDialog.tsx
git commit -m "refactor: extract shared agent and status constants"
```

---

## Task 2: Shared Constants — `src/constants/styles.ts`

**Files:**
- Create: `src/constants/styles.ts`
- Modify: `src/features/settings/components/SettingsModal.tsx` (remove lines 27-49: `inputStyles`, `switchStyles`)
- Modify: `src/features/agents/components/NewAgentDialog.tsx` (remove lines 30-45: `inputStyles`)
- Modify: `src/features/projects/components/NewProjectDialog.tsx` (remove lines 19-35: `inputStyles`)
- Modify: `src/features/bugs/components/ProviderSetup.tsx` (remove local `inputStyles`)
- Modify: `src/features/guardian/components/AgentFeedbackModal.tsx` (replace inline modal styles)

- [ ] **Step 1: Create `src/constants/styles.ts`**

```ts
export const MODAL_STYLES = {
  header: {
    backgroundColor: "var(--bg-elevated)",
    borderBottom: "1px solid var(--border)",
    padding: "16px 20px",
  },
  title: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: 600,
  },
  body: {
    padding: 0,
    backgroundColor: "var(--bg-elevated)",
  },
  content: {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-bright)",
  },
  close: {
    color: "var(--text-secondary)",
  },
};

export const MODAL_OVERLAY_PROPS = { blur: 3, backgroundOpacity: 0.6 };
export const MODAL_TRANSITION_PROPS = { transition: "slide-up" as const };

export const INPUT_STYLES = {
  input: {
    backgroundColor: "var(--bg-tertiary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    "&::placeholder": { color: "var(--text-secondary)" },
    "&:focus": { borderColor: "var(--accent)" },
  },
  label: {
    color: "var(--text-secondary)",
    fontSize: "10px",
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
};

export const BUTTON_STYLES = {
  primary: {
    root: {
      backgroundColor: "var(--accent)",
      color: "var(--bg-primary)",
      "&:hover": { backgroundColor: "var(--accent-hover)" },
      "&:disabled": { opacity: 0.5 },
    },
  },
  subtle: {
    root: {
      color: "var(--text-secondary)",
      "&:hover": {
        color: "var(--text-primary)",
        backgroundColor: "transparent",
      },
    },
  },
};

export const switchStyles = (active: boolean) => ({
  track: {
    backgroundColor: active ? undefined : "var(--bg-tertiary)",
    borderColor: "var(--bg-tertiary)",
  },
});
```

- [ ] **Step 2: Update `SettingsModal.tsx`**

Remove local `inputStyles` (lines 27-42) and `switchStyles` (lines 44-49). Add import:
```ts
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES, switchStyles } from "@/constants/styles";
```

Replace:
- `styles={{ header: {...}, title: {...}, ... }}` on Modal → `styles={{ ...MODAL_STYLES, body: { ...MODAL_STYLES.body, maxHeight: "calc(80vh - 120px)", overflowY: "auto" }, content: { ...MODAL_STYLES.content, maxHeight: "80vh", display: "flex", flexDirection: "column" } }}`
- `overlayProps={{ blur: 3, backgroundOpacity: 0.6 }}` → `overlayProps={MODAL_OVERLAY_PROPS}`
- `transitionProps={{ transition: "slide-up" }}` → `transitionProps={MODAL_TRANSITION_PROPS}`
- `styles={inputStyles}` → `styles={INPUT_STYLES}`
- Button cancel `styles={{ root: { color: ... } }}` → `styles={BUTTON_STYLES.subtle}`
- Button save `styles={{ root: { backgroundColor: ... } }}` → `styles={BUTTON_STYLES.primary}`

- [ ] **Step 3: Update `NewAgentDialog.tsx`**

Remove local `inputStyles` (lines 30-45). Add import:
```ts
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES } from "@/constants/styles";
```

Replace modal styles with `styles={{ ...MODAL_STYLES, content: { ...MODAL_STYLES.content, width: "420px" } }}`.
Replace `overlayProps`, `transitionProps`, `styles={inputStyles}`, and button styles similarly.

- [ ] **Step 4: Update `NewProjectDialog.tsx`**

Remove local `inputStyles` (lines 19-35). Add import:
```ts
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES } from "@/constants/styles";
```

Replace modal styles with `styles={{ ...MODAL_STYLES, content: { ...MODAL_STYLES.content, width: "400px" } }}`.
Replace all instances similarly.

- [ ] **Step 5: Update `AgentFeedbackModal.tsx`**

Add import:
```ts
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, BUTTON_STYLES } from "@/constants/styles";
```

Replace the inline modal styles object (lines 214-236) with `styles={MODAL_STYLES}`.
Replace button styles where applicable.

- [ ] **Step 6: Update `ProviderSetup.tsx`**

Read the file, remove local `inputStyles`, add import:
```ts
import { INPUT_STYLES } from "@/constants/styles";
```

Replace `styles={inputStyles}` → `styles={INPUT_STYLES}`.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit`
Expected: No errors.

```bash
git add src/constants/styles.ts src/features/settings/components/SettingsModal.tsx src/features/agents/components/NewAgentDialog.tsx src/features/projects/components/NewProjectDialog.tsx src/features/guardian/components/AgentFeedbackModal.tsx src/features/bugs/components/ProviderSetup.tsx
git commit -m "refactor: extract shared modal, input, and button styles"
```

---

## Task 3: Component — `SectionTitle`

**Files:**
- Create: `src/components/ui/SectionTitle.tsx`
- Modify: `src/features/settings/components/SettingsModal.tsx`
- Modify: `src/features/settings/components/SettingsModal.module.css` (remove `.sectionTitle`)
- Modify: `src/features/agents/components/NewAgentDialog.tsx`
- Modify: `src/features/agents/components/NewAgentDialog.module.css` (remove `.sectionTitle`)
- Modify: `src/features/projects/components/NewProjectDialog.tsx`
- Modify: `src/features/projects/components/NewProjectDialog.module.css` (remove `.sectionTitle`)
- Modify: `src/features/git/components/GitPanel.tsx`
- Modify: `src/features/git/components/GitPanel.module.css` (remove `.sectionTitle`)

- [ ] **Step 1: Create `src/components/ui/SectionTitle.tsx`**

```tsx
import type { ReactNode } from "react";
import { Text } from "@mantine/core";

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
  mb?: number;
}

export function SectionTitle({ children, className, mb = 8 }: SectionTitleProps) {
  return (
    <Text
      size="xs"
      tt="uppercase"
      lts="0.05em"
      fw={600}
      c="var(--text-secondary)"
      mb={mb}
      className={className}
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 2: Update consumers**

In each file, replace `<Text size="xs" className={classes.sectionTitle}>` with `<SectionTitle>`.

SettingsModal uses `mb={16}`:
```tsx
<SectionTitle mb={16}>Global</SectionTitle>
<SectionTitle mb={16}>Agent Settings</SectionTitle>
```

NewAgentDialog has one with `mb={0}`:
```tsx
<SectionTitle>Agent Type</SectionTitle>
<SectionTitle mb={0}>YOLO Mode</SectionTitle>
```

NewProjectDialog:
```tsx
<SectionTitle mb={6}>Directory Path</SectionTitle>
```

GitPanel uses `<span className={classes.sectionTitle}>` — replace with `<SectionTitle mb={0}>`.

- [ ] **Step 3: Remove `.sectionTitle` from each module.css file**

Remove the `.sectionTitle` class from:
- `SettingsModal.module.css`
- `NewAgentDialog.module.css`
- `NewProjectDialog.module.css`
- `GitPanel.module.css`

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/ui/SectionTitle.tsx src/features/settings/components/SettingsModal.tsx src/features/settings/components/SettingsModal.module.css src/features/agents/components/NewAgentDialog.tsx src/features/agents/components/NewAgentDialog.module.css src/features/projects/components/NewProjectDialog.tsx src/features/projects/components/NewProjectDialog.module.css src/features/git/components/GitPanel.tsx src/features/git/components/GitPanel.module.css
git commit -m "refactor: extract SectionTitle component"
```

---

## Task 4: Component — `AgentBadge`

**Files:**
- Create: `src/components/ui/AgentBadge.tsx`
- Create: `src/components/ui/AgentBadge.module.css`
- Modify: `src/components/layout/TopBar.tsx`
- Modify: `src/components/layout/TopBar.module.css` (remove `.agentBadge`)
- Modify: `src/features/guardian/components/AgentFeedbackModal.tsx`
- Modify: `src/features/guardian/components/AgentFeedbackModal.module.css` (remove `.agentBadge`)

- [ ] **Step 1: Create `src/components/ui/AgentBadge.module.css`**

```css
.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: var(--agent-badge-bg);
  color: var(--agent-badge-color);
}
```

- [ ] **Step 2: Create `src/components/ui/AgentBadge.tsx`**

```tsx
import { getAgentMeta } from "@/constants/agents";
import classes from "./AgentBadge.module.css";

interface AgentBadgeProps {
  agentType: string;
  /** Override display text. Defaults to short label (e.g. "CC"). Use "displayName" for full name. */
  variant?: "label" | "displayName";
  className?: string;
}

export function AgentBadge({ agentType, variant = "label", className }: AgentBadgeProps) {
  const meta = getAgentMeta(agentType);
  return (
    <span
      className={`${classes.badge}${className ? ` ${className}` : ""}`}
      style={{
        "--agent-badge-bg": `color-mix(in srgb, ${meta.color} 15%, transparent)`,
        "--agent-badge-color": meta.color,
      } as React.CSSProperties}
    >
      {variant === "displayName" ? meta.displayName : meta.label}
    </span>
  );
}
```

- [ ] **Step 3: Update `TopBar.tsx`**

Add import: `import { AgentBadge } from "@/components/ui/AgentBadge";`

Replace the agent badge span (lines 48-56):
```tsx
{/* Before */}
<span className={classes.agentBadge} style={{...}}>
  {AGENT_DISPLAY_NAMES[activeSession.agentType] || activeSession.agentType}
</span>

{/* After */}
<AgentBadge agentType={activeSession.agentType} variant="displayName" />
```

Remove `.agentBadge` from `TopBar.module.css`.

- [ ] **Step 4: Update `AgentFeedbackModal.tsx`**

Add import: `import { AgentBadge } from "@/components/ui/AgentBadge";`

Replace the badge span in `modalTitle` (lines 184-192):
```tsx
{/* Before */}
<span className={classes.agentBadge} style={{...}}>
  {agentMeta.label}
</span>

{/* After */}
<AgentBadge agentType={session?.agentType ?? ""} />
```

Remove `.agentBadge` from `AgentFeedbackModal.module.css`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/ui/AgentBadge.tsx src/components/ui/AgentBadge.module.css src/components/layout/TopBar.tsx src/components/layout/TopBar.module.css src/features/guardian/components/AgentFeedbackModal.tsx src/features/guardian/components/AgentFeedbackModal.module.css
git commit -m "refactor: extract AgentBadge component"
```

---

## Task 5: Component — `StatusDot`

**Files:**
- Create: `src/components/ui/StatusDot.tsx`
- Create: `src/components/ui/StatusDot.module.css`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Sidebar.module.css` (remove `.statusDot`)
- Modify: `src/features/terminal/components/TerminalTabs.tsx`
- Modify: `src/features/terminal/components/TerminalTabs.module.css` (remove `.statusDot`)

- [ ] **Step 1: Create `src/components/ui/StatusDot.module.css`**

```css
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
  background-color: var(--dot-color);
}
```

- [ ] **Step 2: Create `src/components/ui/StatusDot.tsx`**

```tsx
import cn from "clsx";
import { getStatusMeta } from "@/constants/agents";
import classes from "./StatusDot.module.css";

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={cn(classes.dot, meta.className, className)}
      style={{ "--dot-color": meta.color } as React.CSSProperties}
    />
  );
}
```

- [ ] **Step 3: Update `Sidebar.tsx`**

Add import: `import { StatusDot } from "@/components/ui/StatusDot";`

Replace (inside session list):
```tsx
{/* Before */}
<span
  className={cn(classes.statusDot, statusColor.className)}
  style={{ '--status-color': statusColor.bg } as React.CSSProperties}
/>

{/* After */}
<StatusDot status={session.status} />
```

Remove `.statusDot` from `Sidebar.module.css`.

- [ ] **Step 4: Update `TerminalTabs.tsx`**

Add import: `import { StatusDot } from "@/components/ui/StatusDot";`

Replace in `FlatTabs` (line 462-465):
```tsx
{/* After */}
<StatusDot status={session.status} />
```

Replace in `SessionTab` (lines 547-550):
```tsx
{/* After */}
<StatusDot status={session.status} />
```

Remove `.statusDot` from `TerminalTabs.module.css`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/ui/StatusDot.tsx src/components/ui/StatusDot.module.css src/components/layout/Sidebar.tsx src/components/layout/Sidebar.module.css src/features/terminal/components/TerminalTabs.tsx src/features/terminal/components/TerminalTabs.module.css
git commit -m "refactor: extract StatusDot component"
```

---

## Task 6: Component — `EmptyState`

**Files:**
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/EmptyState.module.css`
- Modify: `src/features/git/components/GitPanel.tsx`
- Modify: `src/features/git/components/GitPanel.module.css` (remove `.emptyState`, `.notRepoState`, `.notRepoText`)
- Modify: `src/features/notifications/components/NotificationCenter.tsx`
- Modify: `src/features/notifications/components/NotificationCenter.module.css` (remove `.emptyState`, `.emptyText`)

Note: TerminalContainer's empty state has custom animation class and action button placement that make it different enough to leave as-is.

- [ ] **Step 1: Create `src/components/ui/EmptyState.module.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary);
}
```

- [ ] **Step 2: Create `src/components/ui/EmptyState.tsx`**

```tsx
import type { ReactNode } from "react";
import { Text } from "@mantine/core";
import cn from "clsx";
import classes from "./EmptyState.module.css";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn(classes.container, className)}>
      {icon}
      <div style={{ textAlign: "center" }}>
        <Text size="sm" c="var(--text-primary)">
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed" mt={4}>
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Update `GitPanel.tsx`**

Add import: `import { EmptyState } from "@/components/ui/EmptyState";`

Replace "Select a project" empty state (lines 78-83):
```tsx
<EmptyState icon={<GitBranch size={40} strokeWidth={1} />} title="Select a project to view git status" />
```

Replace "Not a git repository" state (lines 86-100):
```tsx
<EmptyState
  icon={<GitMerge size={40} strokeWidth={1} />}
  title="Not a git repository"
  description={activeProject.path}
/>
```

Remove `.emptyState`, `.notRepoState`, `.notRepoText` from `GitPanel.module.css`. Keep `.emptyFiles` (different pattern — used for inline loading/empty within file list).

- [ ] **Step 4: Update `NotificationCenter.tsx`**

Add import: `import { EmptyState } from "@/components/ui/EmptyState";`

Replace empty state (lines 112-123):
```tsx
<EmptyState
  icon={<Bell size={40} strokeWidth={1} />}
  title="No notifications"
  description="Agent events will appear here"
/>
```

Remove `.emptyState`, `.emptyText` from `NotificationCenter.module.css`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/ui/EmptyState.tsx src/components/ui/EmptyState.module.css src/features/git/components/GitPanel.tsx src/features/git/components/GitPanel.module.css src/features/notifications/components/NotificationCenter.tsx src/features/notifications/components/NotificationCenter.module.css
git commit -m "refactor: extract EmptyState component"
```

---

## Task 7: Component — `ModalFooter`

**Files:**
- Create: `src/components/ui/ModalFooter.tsx`
- Create: `src/components/ui/ModalFooter.module.css`
- Modify: `src/features/settings/components/SettingsModal.tsx`
- Modify: `src/features/settings/components/SettingsModal.module.css` (remove `.footer`)
- Modify: `src/features/agents/components/NewAgentDialog.tsx`
- Modify: `src/features/agents/components/NewAgentDialog.module.css` (remove `.footer`)
- Modify: `src/features/projects/components/NewProjectDialog.tsx`
- Modify: `src/features/projects/components/NewProjectDialog.module.css` (remove `.footer`)
- Modify: `src/features/guardian/components/AgentFeedbackModal.tsx`
- Modify: `src/features/guardian/components/AgentFeedbackModal.module.css` (remove `.footer`)

- [ ] **Step 1: Create `src/components/ui/ModalFooter.module.css`**

```css
.footer {
  border-top: 1px solid var(--border);
  padding: 16px 20px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Create `src/components/ui/ModalFooter.tsx`**

```tsx
import type { ReactNode } from "react";
import { Group } from "@mantine/core";
import classes from "./ModalFooter.module.css";

interface ModalFooterProps {
  children: ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className={classes.footer}>
      <Group justify="flex-end" gap="xs">
        {children}
      </Group>
    </div>
  );
}
```

- [ ] **Step 3: Update all 4 modal consumers**

Add import: `import { ModalFooter } from "@/components/ui/ModalFooter";`

Replace in each file:
```tsx
{/* Before */}
<div className={classes.footer}>
  <Group justify="flex-end" gap="xs">
    ...buttons...
  </Group>
</div>

{/* After */}
<ModalFooter>
  ...buttons...
</ModalFooter>
```

Remove `.footer` from each `.module.css` file.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/ui/ModalFooter.tsx src/components/ui/ModalFooter.module.css src/features/settings/components/SettingsModal.tsx src/features/settings/components/SettingsModal.module.css src/features/agents/components/NewAgentDialog.tsx src/features/agents/components/NewAgentDialog.module.css src/features/projects/components/NewProjectDialog.tsx src/features/projects/components/NewProjectDialog.module.css src/features/guardian/components/AgentFeedbackModal.tsx src/features/guardian/components/AgentFeedbackModal.module.css
git commit -m "refactor: extract ModalFooter component"
```

---

## Task 8: Final Cleanup

- [ ] **Step 1: Remove unused CSS classes**

Check each modified `.module.css` file for now-orphaned classes (e.g. `.content` in modal CSS files that were only used with the footer). Run `npx tsc --noEmit` after each removal.

- [ ] **Step 2: Create barrel export**

Create `src/components/ui/index.ts`:
```ts
export { SectionTitle } from "./SectionTitle";
export { AgentBadge } from "./AgentBadge";
export { StatusDot } from "./StatusDot";
export { EmptyState } from "./EmptyState";
export { ModalFooter } from "./ModalFooter";
```

- [ ] **Step 3: Final verification**

Run: `npx tsc --noEmit`
Expected: No errors.

```bash
git add src/components/ui/index.ts
git commit -m "refactor: add barrel export for ui components"
```
