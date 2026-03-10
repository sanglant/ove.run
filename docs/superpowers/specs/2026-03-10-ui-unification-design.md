# UI Unification: Extract Reusable Components

## Goal

Eliminate duplicated UI patterns by extracting shared constants and reusable components into `src/constants/` and `src/components/ui/`.

## Shared Constants

### `src/constants/agents.ts`

Single source of truth for agent metadata and status colors, currently duplicated across 4+ files.

```ts
export const AGENT_META: Record<string, { label: string; color: string; displayName: string }> = {
  claude:   { label: "CC", color: "var(--claude)",          displayName: "Claude" },
  gemini:   { label: "GC", color: "var(--gemini)",          displayName: "Gemini" },
  copilot:  { label: "CP", color: "var(--copilot)",         displayName: "Copilot" },
  codex:    { label: "CX", color: "var(--codex)",           displayName: "Codex" },
  terminal: { label: ">_", color: "var(--text-secondary)",  displayName: "Terminal" },
};

export const STATUS_META: Record<string, { label: string; color: string; className?: string }> = {
  starting:    { label: "Starting",    color: "var(--warning)" },
  idle:        { label: "Idle",        color: "var(--text-secondary)" },
  working:     { label: "Working",     color: "var(--accent)",   className: "animate-pulse-glow" },
  needs_input: { label: "Needs Input", color: "var(--warning)",  className: "animate-status-pulse" },
  finished:    { label: "Finished",    color: "var(--success)" },
  error:       { label: "Error",       color: "var(--danger)" },
};
```

**Consumers to update:**
- `Sidebar.tsx` — remove `STATUS_COLORS`, `AGENT_ICON`
- `TerminalTabs.tsx` — remove `STATUS_COLORS`, `AGENT_LABEL`, `AGENT_COLOR`
- `TopBar.tsx` — remove `STATUS_LABELS`, `AGENT_DISPLAY_NAMES`
- `AgentFeedbackModal.tsx` — remove `AGENT_META`
- `NewAgentDialog.tsx` — remove `AGENT_META`
- `StatusBar.tsx` — remove `STATUS_COLORS`

### `src/constants/styles.ts`

Shared Mantine style objects, currently copy-pasted across 4+ files.

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
```

**Consumers to update:**
- `SettingsModal.tsx` — remove local `inputStyles`, `modalStyles`, button styles
- `NewProjectDialog.tsx` — remove local `inputStyles`, modal styles
- `NewAgentDialog.tsx` — remove local `inputStyles`, modal styles
- `AgentFeedbackModal.tsx` — remove modal styles
- `ProviderSetup.tsx` — remove local `inputStyles`

## Reusable Components

### `src/components/ui/SectionTitle.tsx`

Uppercase label for form/dialog sections.

```tsx
interface SectionTitleProps {
  children: ReactNode;
  className?: string;
  mb?: number;  // margin-bottom override, defaults to component-specific value via CSS
}
```

Renders a `<Text>` with `size="xs"`, `tt="uppercase"`, `lts="0.05em"`, `fw={600}`, `c="var(--text-secondary)"`.

**Replaces `.sectionTitle` in:** NewAgentDialog, NewProjectDialog, SettingsModal, GitPanel.

### `src/components/ui/AgentBadge.tsx`

Colored pill badge showing agent type.

```tsx
interface AgentBadgeProps {
  agentType: string;
  className?: string;
}
```

Reads from `AGENT_META` to get label + color. Renders a `<span>` with `background: color-mix(in srgb, {color} 15%, transparent)`, `color: {color}`, uppercase, bold, small text.

**Replaces agent badge markup in:** TopBar, AgentFeedbackModal, Sidebar, NewAgentDialog.

### `src/components/ui/StatusDot.tsx`

Small colored circle for session status.

```tsx
interface StatusDotProps {
  status: string;
  className?: string;
}
```

Reads from `STATUS_META` to get color + optional animation className. Renders a 6px circle with the status color.

**Replaces status dot markup in:** Sidebar (sessions list), TerminalTabs (flat tabs + compact tabs).

### `src/components/ui/EmptyState.tsx`

Centered placeholder with icon and text.

```tsx
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;  // optional action buttons below text
}
```

Renders a flex-column centered container with the icon, title text, optional description, and optional children.

**Replaces empty state layouts in:** GitPanel (2 instances), NotificationCenter, TerminalContainer.

### `src/components/ui/ModalFooter.tsx`

Footer strip for modal dialogs.

```tsx
interface ModalFooterProps {
  children: ReactNode;
}
```

Renders a `<div>` with `border-top: 1px solid var(--border)`, `padding: 16px 20px`, containing a right-aligned `<Group>`.

**Replaces `.footer` div in:** SettingsModal, NewProjectDialog, NewAgentDialog, AgentFeedbackModal.

## Out of Scope

- `PanelContainer` — single-use CSS class in App.tsx
- `IconButton` — Mantine's `ActionIcon` covers this
- `YoloBadge` — single use in Sidebar
- `RevealOnHover` — CSS-only pattern, already works

## File Structure After

```
src/
  constants/
    agents.ts        # AGENT_META, STATUS_META
    styles.ts        # MODAL_STYLES, INPUT_STYLES, BUTTON_STYLES
  components/
    ui/
      SectionTitle.tsx
      AgentBadge.tsx
      StatusDot.tsx
      EmptyState.tsx
      ModalFooter.tsx
```
