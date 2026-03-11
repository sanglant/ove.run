# Driver.js Interactive Tours Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive guided tours using driver.js for onboarding, per-panel help, and bug tracker integration instructions.

**Architecture:** Centralized `useTour` hook wraps driver.js with dark-themed Mantine popovers. Tour configs live in `src/constants/tours/`. A `tourStore` (Zustand + localStorage) tracks first-start state. The StatusBar gets a help button, and ProviderSetup gets an Instructions button.

**Tech Stack:** driver.js 1.4.0 (already installed), React 19, Mantine 7, Zustand 5

**Spec:** `docs/superpowers/specs/2026-03-11-driver-js-tours-design.md`

---

## Chunk 1: Core Tour Infrastructure

### Task 1: Create tour store

**Files:**
- Create: `src/stores/tourStore.ts`

- [ ] **Step 1: Create the tour store**

```typescript
// src/stores/tourStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TourState {
  hasSeenHomeTour: boolean;
  setHomeTourSeen: () => void;
  resetHomeTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasSeenHomeTour: false,
      setHomeTourSeen: () => set({ hasSeenHomeTour: true }),
      resetHomeTour: () => set({ hasSeenHomeTour: false }),
    }),
    { name: "agentic-tour-state" },
  ),
);
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to tourStore

- [ ] **Step 3: Commit**

```bash
git add src/stores/tourStore.ts
git commit -m "feat: add tour store with localStorage persistence"
```

### Task 2: Create tour CSS overrides

**Files:**
- Create: `src/styles/tour.css`

- [ ] **Step 1: Create the dark theme CSS for driver.js**

```css
/* src/styles/tour.css */
/* Driver.js dark theme overrides using app CSS variables */

.driver-popover {
  background-color: var(--bg-secondary) !important;
  border: 1px solid var(--border-bright) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  color: var(--text-primary) !important;
  max-width: 320px !important;
  padding: 0 !important;
}

.driver-popover-title {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
  font-family: inherit !important;
}

.driver-popover-description {
  font-size: 12px !important;
  color: var(--text-secondary) !important;
  line-height: 1.5 !important;
  font-family: inherit !important;
}

.driver-popover-progress-text {
  font-size: 10px !important;
  color: var(--text-secondary) !important;
}

.driver-popover-navigation-btns {
  gap: 6px !important;
}

.driver-popover-prev-btn,
.driver-popover-next-btn {
  font-size: 11px !important;
  padding: 4px 12px !important;
  border-radius: 4px !important;
  font-weight: 500 !important;
  text-shadow: none !important;
  border: none !important;
}

.driver-popover-prev-btn {
  background-color: var(--bg-tertiary) !important;
  color: var(--text-secondary) !important;
}

.driver-popover-prev-btn:hover {
  background-color: var(--border-bright) !important;
  color: var(--text-primary) !important;
}

.driver-popover-next-btn,
.driver-popover-close-btn-inside {
  background-color: var(--accent) !important;
  color: var(--bg-primary) !important;
}

.driver-popover-next-btn:hover {
  background-color: var(--accent-hover) !important;
}

.driver-popover-close-btn-inside {
  font-size: 11px !important;
  padding: 4px 12px !important;
  border-radius: 4px !important;
}

.driver-popover-arrow {
  border-color: var(--bg-secondary) !important;
}

.driver-popover-arrow-side-left.driver-popover-arrow {
  border-left-color: var(--bg-secondary) !important;
}

.driver-popover-arrow-side-right.driver-popover-arrow {
  border-right-color: var(--bg-secondary) !important;
}

.driver-popover-arrow-side-top.driver-popover-arrow {
  border-top-color: var(--bg-secondary) !important;
}

.driver-popover-arrow-side-bottom.driver-popover-arrow {
  border-bottom-color: var(--bg-secondary) !important;
}

/* Overlay */
.driver-overlay {
  background-color: rgba(0, 0, 0, 0.6) !important;
}
```

- [ ] **Step 2: Import the CSS in main.tsx**

In `src/main.tsx`, add after `import "./styles/globals.css";`:

```typescript
import "./styles/tour.css";
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tour.css src/main.tsx
git commit -m "feat: add dark theme CSS overrides for driver.js"
```

### Task 3: Create tour config files

**Files:**
- Create: `src/constants/tours/home.ts`
- Create: `src/constants/tours/terminal.ts`
- Create: `src/constants/tours/git.ts`
- Create: `src/constants/tours/knowledge.ts`
- Create: `src/constants/tours/notes.ts`
- Create: `src/constants/tours/bugs.ts`
- Create: `src/constants/tours/bugSetup.ts`
- Create: `src/constants/tours/index.ts`

- [ ] **Step 1: Create home tour config**

```typescript
// src/constants/tours/home.ts
import type { DriveStep } from "driver.js";

export const homeTour: DriveStep[] = [
  {
    element: '[data-tour="sidebar-project-list"]',
    popover: {
      title: "Projects",
      description: "Create projects to organize your agent sessions.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="sidebar-terminal"]',
    popover: {
      title: "Terminal",
      description: "Run AI agent sessions in the terminal.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-git"]',
    popover: {
      title: "Git",
      description: "View repository status, diffs, and make commits.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-knowledge"]',
    popover: {
      title: "Knowledge",
      description: "Manage system prompts and context files for agents.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-notes"]',
    popover: {
      title: "Notes",
      description: "Keep project notes and documentation.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-bugs"]',
    popover: {
      title: "Bug Tracker",
      description: "Track and delegate bugs from Jira, GitHub, or YouTrack.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-settings"]',
    popover: {
      title: "Settings",
      description: "Configure app preferences, guardian provider, and more.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="project-guardian-toggle"]',
    popover: {
      title: "Guardian",
      description:
        "Guardian auto-answers agent questions using AI. Enable per-project from the project list.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="statusbar-notifications"]',
    popover: {
      title: "Notifications",
      description: "Get notified about agent activity and guardian decisions.",
      side: "top",
      align: "end",
    },
  },
];
```

- [ ] **Step 2: Create terminal tour config**

```typescript
// src/constants/tours/terminal.ts
import type { DriveStep } from "driver.js";

export const terminalTour: DriveStep[] = [
  {
    element: '[data-tour="terminal-tabs"]',
    popover: {
      title: "Session Tabs",
      description: "Switch between agent sessions. Drag tabs to reorder them.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="terminal-layout"]',
    popover: {
      title: "Layout Mode",
      description: "Change terminal layout between single pane and grid mode.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="terminal-new-session"]',
    popover: {
      title: "New Session",
      description: "Start a new agent session for the active project.",
      side: "bottom",
      align: "center",
    },
  },
];
```

- [ ] **Step 3: Create git tour config**

```typescript
// src/constants/tours/git.ts
import type { DriveStep } from "driver.js";

export const gitTour: DriveStep[] = [
  {
    element: '[data-tour="git-file-list"]',
    popover: {
      title: "File Changes",
      description:
        "See changed files and their status. Click a file to view its diff. Double-click to stage or unstage.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="git-diff"]',
    popover: {
      title: "Diff Viewer",
      description: "Review changes before committing. Shows line-by-line additions and deletions.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="git-commit"]',
    popover: {
      title: "Commit",
      description: "Stage files and create commits with a message.",
      side: "right",
      align: "end",
    },
  },
];
```

- [ ] **Step 4: Create knowledge tour config**

```typescript
// src/constants/tours/knowledge.ts
import type { DriveStep } from "driver.js";

export const knowledgeTour: DriveStep[] = [
  {
    element: '[data-tour="knowledge-file-list"]',
    popover: {
      title: "Knowledge Entries",
      description:
        "Manage context files loaded into agent sessions. Organized by type: system prompts, context files, and notes.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="knowledge-editor"]',
    popover: {
      title: "Editor",
      description: "Edit system prompts and knowledge documents in a markdown workspace.",
      side: "left",
      align: "start",
    },
  },
];
```

- [ ] **Step 5: Create notes tour config**

```typescript
// src/constants/tours/notes.ts
import type { DriveStep } from "driver.js";

export const notesTour: DriveStep[] = [
  {
    element: '[data-tour="notes-list"]',
    popover: {
      title: "Notes List",
      description: "Organize notes per project. Create, browse, and delete markdown documents.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="notes-editor"]',
    popover: {
      title: "Editor",
      description: "Rich text editor with markdown support for writing and formatting notes.",
      side: "left",
      align: "start",
    },
  },
];
```

- [ ] **Step 6: Create bugs tour config**

```typescript
// src/constants/tours/bugs.ts
import type { DriveStep } from "driver.js";

export const bugsTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-list"]',
    popover: {
      title: "Bug List",
      description: "Browse and search bugs from your connected provider.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-detail"]',
    popover: {
      title: "Bug Details",
      description: "View full bug details including status, priority, and description.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-delegate"]',
    popover: {
      title: "Delegate to Agent",
      description: "Send a bug to an AI agent for fixing. Creates a pre-filled agent session.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="bugs-refresh"]',
    popover: {
      title: "Refresh",
      description: "Sync latest bugs from your provider.",
      side: "bottom",
      align: "center",
    },
  },
];
```

- [ ] **Step 7: Create bug setup tour configs**

```typescript
// src/constants/tours/bugSetup.ts
import type { DriveStep } from "driver.js";

const providerSelectStep: DriveStep = {
  element: '[data-tour="bugs-provider-select"]',
  popover: {
    title: "Choose Provider",
    description: "Select your bug tracking provider to get started.",
    side: "bottom",
    align: "center",
  },
};

export const jiraSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select Jira as your bug tracker.",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        "Go to developer.atlassian.com → Profile icon → Developer console → Create → OAuth 2.0 integration. Then go to Settings in the left menu to find your Client ID.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On the same Settings page in your Atlassian Developer Console, copy the Client Secret.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL (optional)",
      description:
        "Optionally enter your Jira Cloud URL if using a custom domain (e.g., https://yourteam.atlassian.net).",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "Your project key is the prefix before issue numbers (e.g., PROJ in PROJ-123). Find it under Projects in Jira's top navigation.",
      side: "bottom",
      align: "start",
    },
  },
];

export const githubSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select GitHub Issues.",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        "Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. After registering, the Client ID is shown on the app page.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On your OAuth App page, click 'Generate a new client secret'. Copy it immediately — it won't be shown again.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Repository",
      description:
        "Enter as owner/repo (e.g., octocat/Hello-World) — read directly from your repository URL: github.com/{owner}/{repo}.",
      side: "bottom",
      align: "start",
    },
  },
];

export const youtrackSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select YouTrack.",
    },
  },
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL",
      description:
        "Enter your YouTrack instance URL (e.g., https://myteam.youtrack.cloud).",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID (Service ID)",
      description:
        "In YouTrack, go to Administration → Server Settings → Services → New service. After creation, find the Service ID (Client ID) on the service's Settings tab.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On the same Settings tab of your service in Hub, copy the Secret. You can regenerate it with the Change button.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "The project short name appears as a prefix in issue IDs (e.g., XT in XT-123). Find it under Projects in YouTrack.",
      side: "bottom",
      align: "start",
    },
  },
];

export const genericSetupTour: DriveStep[] = [providerSelectStep];
```

- [ ] **Step 8: Create barrel export**

```typescript
// src/constants/tours/index.ts
import type { DriveStep } from "driver.js";
import { homeTour } from "./home";
import { terminalTour } from "./terminal";
import { gitTour } from "./git";
import { knowledgeTour } from "./knowledge";
import { notesTour } from "./notes";
import { bugsTour } from "./bugs";

export { homeTour } from "./home";
export { terminalTour } from "./terminal";
export { gitTour } from "./git";
export { knowledgeTour } from "./knowledge";
export { notesTour } from "./notes";
export { bugsTour } from "./bugs";
export {
  jiraSetupTour,
  githubSetupTour,
  youtrackSetupTour,
  genericSetupTour,
} from "./bugSetup";

export const panelTours: Record<string, DriveStep[]> = {
  terminal: terminalTour,
  git: gitTour,
  knowledge: knowledgeTour,
  notes: notesTour,
  bugs: bugsTour,
};
```

- [ ] **Step 9: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add src/constants/tours/
git commit -m "feat: add tour config files for all panels and bug setup"
```

### Task 4: Create the useTour hook

**Files:**
- Create: `src/hooks/useTour.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useTour.ts
import { useCallback, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider, Button, Group, Text } from "@mantine/core";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { agenticTheme, cssResolver } from "@/theme";
import { panelTours, homeTour } from "@/constants/tours";

function filterAvailableSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (!step.element) return true;
    const selector =
      typeof step.element === "string" ? step.element : null;
    if (!selector) return true;
    return document.querySelector(selector) !== null;
  });
}

export function useTour() {
  const [isRunning, setIsRunning] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const popoverRootRef = useRef<Root | null>(null);

  const cleanupPopoverRoot = useCallback(() => {
    if (popoverRootRef.current) {
      popoverRootRef.current.unmount();
      popoverRootRef.current = null;
    }
  }, []);

  const startTour = useCallback(
    (steps: DriveStep[], onComplete?: () => void) => {
      // Destroy any existing tour
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      cleanupPopoverRoot();

      const available = filterAvailableSteps(steps);
      if (available.length === 0) return;

      const instance = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 6,
        popoverOffset: 12,
        steps: available,
        onPopoverRender: (popover, { state }) => {
          // Unmount previous React root before creating a new one
          cleanupPopoverRoot();

          const footerEl = popover.footerButtons;
          if (!footerEl) return;

          // Clear default buttons
          footerEl.innerHTML = "";

          const container = document.createElement("div");
          footerEl.appendChild(container);

          const root = createRoot(container);
          popoverRootRef.current = root;

          const isFirst = state.activeIndex === 0;
          const isLast = state.activeIndex === (available.length - 1);

          root.render(
            <MantineProvider
              theme={agenticTheme}
              forceColorScheme="dark"
              cssVariablesResolver={cssResolver}
            >
              <Group gap={6} justify="flex-end" p={0}>
                {!isFirst && (
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    onClick={() => instance.movePrevious()}
                    styles={{
                      root: {
                        color: "var(--text-secondary)",
                        fontSize: 11,
                      },
                    }}
                  >
                    Previous
                  </Button>
                )}
                <Button
                  size="compact-xs"
                  onClick={() => {
                    if (isLast) {
                      instance.destroy();
                    } else {
                      instance.moveNext();
                    }
                  }}
                  styles={{
                    root: {
                      backgroundColor: "var(--accent)",
                      color: "var(--bg-primary)",
                      fontSize: 11,
                      "&:hover": {
                        backgroundColor: "var(--accent-hover)",
                      },
                    },
                  }}
                >
                  {isLast ? "Done" : "Next"}
                </Button>
              </Group>
            </MantineProvider>,
          );
        },
        onDestroyed: () => {
          cleanupPopoverRoot();
          setIsRunning(false);
          driverRef.current = null;
          onComplete?.();
        },
      });

      driverRef.current = instance;
      setIsRunning(true);
      instance.drive();
    },
    [cleanupPopoverRoot],
  );

  const startPanelTour = useCallback(
    (panelName: string) => {
      const steps = panelTours[panelName];
      if (!steps) return;
      startTour(steps);
    },
    [startTour],
  );

  const startHomeTour = useCallback(
    (onComplete?: () => void) => {
      startTour(homeTour, onComplete);
    },
    [startTour],
  );

  const stopTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
      cleanupPopoverRoot();
      setIsRunning(false);
    }
  }, [cleanupPopoverRoot]);

  return { startTour, startPanelTour, startHomeTour, stopTour, isRunning };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTour.ts
git commit -m "feat: add useTour hook wrapping driver.js"
```

## Chunk 2: Data Tour Attributes

### Task 5: Add data-tour attributes to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add data-tour to project list section**

In `src/components/layout/Sidebar.tsx`, find the project list scrollable area (line 166):
```typescript
        <div className={classes.projectsScroll}>
```
Change to:
```typescript
        <div className={classes.projectsScroll} data-tour="sidebar-project-list">
```

- [ ] **Step 2: Add data-tour to guardian toggle**

Find the guardian toggle button (line 246):
```typescript
                      <button
                        onClick={(e) => handleGuardianToggle(e, project)}
                        aria-label={guardianActive ? `Disable guardian for ${project.name}` : `Enable guardian for ${project.name}`}
                        aria-pressed={guardianActive}
                        className={cn(classes.iconButton, guardianActive ? classes.guardianActive : classes.revealOnHover)}
                      >
```

Add `data-tour` only to the active project's guardian toggle. Change to:
```typescript
                      <button
                        onClick={(e) => handleGuardianToggle(e, project)}
                        aria-label={guardianActive ? `Disable guardian for ${project.name}` : `Enable guardian for ${project.name}`}
                        aria-pressed={guardianActive}
                        className={cn(classes.iconButton, guardianActive ? classes.guardianActive : classes.revealOnHover)}
                        {...(isActiveProject ? { "data-tour": "project-guardian-toggle" } : {})}
                      >
```

- [ ] **Step 3: Add data-tour to nav items**

In the `navItems` array (line 116), add `tourId` to each item that needs a tour attribute. Replace the navItems definition:

```typescript
  const navItems = [
    {
      id: "terminal" as const,
      icon: <Terminal size={16} />,
      label: "Terminal",
      tourId: "sidebar-terminal",
    },
    {
      id: "git" as const,
      icon: <FolderGit2 size={16} />,
      label: "Git",
      tourId: "sidebar-git",
    },
    {
      id: "knowledge" as const,
      icon: <BookOpen size={16} />,
      label: "Knowledge",
      tourId: "sidebar-knowledge",
    },
    {
      id: "notes" as const,
      icon: <StickyNote size={16} />,
      label: "Notes",
      tourId: "sidebar-notes",
    },
    {
      id: "bugs" as const,
      icon: <Bug size={16} />,
      label: "Bugs",
      tourId: "sidebar-bugs",
    },
    {
      id: "settings" as const,
      icon: <Settings size={16} />,
      label: "Settings",
      tourId: "sidebar-settings",
    },
    {
      id: "notifications" as const,
      icon: <Bell size={16} />,
      label: "Notifications",
    },
  ];
```

Then in the nav render (line 355, the `<ActionIcon>` element), add the data-tour attribute:

Find:
```typescript
                <ActionIcon
                  variant="subtle"
                  onClick={() => setActivePanel(item.id)}
                  aria-label={item.label}
                  aria-pressed={isActive}
                  title={item.label}
                  size={28}
```

Change to:
```typescript
                <ActionIcon
                  variant="subtle"
                  onClick={() => setActivePanel(item.id)}
                  aria-label={item.label}
                  aria-pressed={isActive}
                  title={item.label}
                  size={28}
                  {...("tourId" in item ? { "data-tour": item.tourId } : {})}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add data-tour attributes to sidebar nav and project list"
```

### Task 6: Add data-tour attributes to Terminal components

**Files:**
- Modify: `src/features/terminal/components/TerminalTabs.tsx`

- [ ] **Step 1: Add data-tour to terminal tabs root**

In `src/features/terminal/components/TerminalTabs.tsx`, find the root element (line 242):
```typescript
    <div className={classes.root}>
```
Change to:
```typescript
    <div className={classes.root} data-tour="terminal-tabs">
```

- [ ] **Step 2: Add data-tour to layout toggle**

Find the `layoutToggle` variable (line 188):
```typescript
    <div className={classes.layoutToggle} role="group" aria-label="Terminal layout">
```
Change to:
```typescript
    <div className={classes.layoutToggle} role="group" aria-label="Terminal layout" data-tour="terminal-layout">
```

- [ ] **Step 3: Add data-tour to new session button**

Find the `newButton` variable (line 207):
```typescript
    <ActionIcon
      variant="subtle"
      onClick={onNewSession}
      aria-label="New session"
      className={classes.actionIcon}
      data-separated
    >
```
Change to:
```typescript
    <ActionIcon
      variant="subtle"
      onClick={onNewSession}
      aria-label="New session"
      className={classes.actionIcon}
      data-separated
      data-tour="terminal-new-session"
    >
```

- [ ] **Step 4: Commit**

```bash
git add src/features/terminal/components/TerminalTabs.tsx
git commit -m "feat: add data-tour attributes to terminal tabs"
```

### Task 7: Add data-tour attributes to Git panel

**Files:**
- Modify: `src/features/git/components/GitPanel.tsx`

- [ ] **Step 1: Add data-tour to file list panel**

In `src/features/git/components/GitPanel.tsx`, find the file list panel (line 105):
```typescript
      <div className={classes.fileListPanel}>
```
Change to:
```typescript
      <div className={classes.fileListPanel} data-tour="git-file-list">
```

- [ ] **Step 2: Add data-tour to diff panel**

Find the diff panel (line 257):
```typescript
      <div className={classes.diffPanel}>
```
Change to:
```typescript
      <div className={classes.diffPanel} data-tour="git-diff">
```

- [ ] **Step 3: Add data-tour to commit form**

Find the CommitForm usage (line 253):
```typescript
        <CommitForm stagedCount={stagedFiles.length} onCommit={commitChanges} />
```

Wrap CommitForm in a div with data-tour, or add data-tour to the CommitForm's file list panel parent. Since CommitForm is at the bottom of the file list, wrap it:

Replace:
```typescript
        <CommitForm stagedCount={stagedFiles.length} onCommit={commitChanges} />
      </div>
```
With:
```typescript
        <div data-tour="git-commit">
          <CommitForm stagedCount={stagedFiles.length} onCommit={commitChanges} />
        </div>
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/features/git/components/GitPanel.tsx
git commit -m "feat: add data-tour attributes to git panel"
```

### Task 8: Add data-tour attributes to Knowledge panel

**Files:**
- Modify: `src/features/knowledge/components/KnowledgePanel.tsx`

- [ ] **Step 1: Add data-tour to sidebar (file list)**

In `src/features/knowledge/components/KnowledgePanel.tsx`, find the sidebar aside (line 256):
```typescript
      <aside className={classes.sidebar} aria-label="Knowledge navigation">
```
Change to:
```typescript
      <aside className={classes.sidebar} aria-label="Knowledge navigation" data-tour="knowledge-file-list">
```

- [ ] **Step 2: Add data-tour to editor area**

Find the editor area main (line 437):
```typescript
      <main className={classes.editorArea}>
```
Change to:
```typescript
      <main className={classes.editorArea} data-tour="knowledge-editor">
```

- [ ] **Step 3: Commit**

```bash
git add src/features/knowledge/components/KnowledgePanel.tsx
git commit -m "feat: add data-tour attributes to knowledge panel"
```

### Task 9: Add data-tour attributes to Notes panel

**Files:**
- Modify: `src/features/notes/components/NotesPanel.tsx`

- [ ] **Step 1: Add data-tour to sidebar**

In `src/features/notes/components/NotesPanel.tsx`, find the sidebar aside (line 241):
```typescript
      <aside className={classes.sidebar} aria-label="Notes navigation">
```
Change to:
```typescript
      <aside className={classes.sidebar} aria-label="Notes navigation" data-tour="notes-list">
```

- [ ] **Step 2: Add data-tour to editor area**

Find the editor area main (line 378):
```typescript
      <main className={classes.editorArea}>
```
Change to:
```typescript
      <main className={classes.editorArea} data-tour="notes-editor">
```

- [ ] **Step 3: Commit**

```bash
git add src/features/notes/components/NotesPanel.tsx
git commit -m "feat: add data-tour attributes to notes panel"
```

### Task 10: Add data-tour attributes to Bugs panel

**Files:**
- Modify: `src/features/bugs/components/BugsPanel.tsx`
- Modify: `src/features/bugs/components/BugDetailView.tsx`

- [ ] **Step 1: Add data-tour to bug list sidebar**

In `src/features/bugs/components/BugsPanel.tsx`, find the sidebar (line 166):
```typescript
      <aside className={classes.sidebar} aria-label="Bug list navigation">
```
Change to:
```typescript
      <aside className={classes.sidebar} aria-label="Bug list navigation" data-tour="bugs-list">
```

- [ ] **Step 2: Add data-tour to main area**

Find the main area (line 269):
```typescript
      <main className={classes.mainArea}>
```
Change to:
```typescript
      <main className={classes.mainArea} data-tour="bugs-detail">
```

- [ ] **Step 3: Add data-tour to refresh button**

Find the refresh button (line 181):
```typescript
            <button
              type="button"
              className={classes.iconButton}
              onClick={() => void handleRefreshBugs()}
              disabled={loading}
              aria-label="Refresh bugs"
              title="Refresh"
            >
```
Change to:
```typescript
            <button
              type="button"
              className={classes.iconButton}
              onClick={() => void handleRefreshBugs()}
              disabled={loading}
              aria-label="Refresh bugs"
              title="Refresh"
              data-tour="bugs-refresh"
            >
```

- [ ] **Step 4: Add data-tour to delegate button in BugDetailView**

In `src/features/bugs/components/BugDetailView.tsx`, find the delegate button (line 50):
```typescript
            <button
              type="button"
              className={classes.delegateButton}
              onClick={handleDelegate}
              aria-label={`Delegate ${bug.key} to agent`}
            >
```
Change to:
```typescript
            <button
              type="button"
              className={classes.delegateButton}
              onClick={handleDelegate}
              aria-label={`Delegate ${bug.key} to agent`}
              data-tour="bugs-delegate"
            >
```

- [ ] **Step 5: Commit**

```bash
git add src/features/bugs/components/BugsPanel.tsx src/features/bugs/components/BugDetailView.tsx
git commit -m "feat: add data-tour attributes to bugs panel"
```

### Task 11: Add data-tour attributes to ProviderSetup

**Files:**
- Modify: `src/features/bugs/components/ProviderSetup.tsx`

- [ ] **Step 1: Add data-tour to provider grid**

In `src/features/bugs/components/ProviderSetup.tsx`, find the provider grid (line 142):
```typescript
        <div className={classes.providerGrid}>
```
Change to:
```typescript
        <div className={classes.providerGrid} data-tour="bugs-provider-select">
```

- [ ] **Step 2: Add data-tour to form fields**

Find the Client ID TextInput (line 184):
```typescript
              <TextInput
                label="Client ID"
```
Add `data-tour="bugs-client-id"` as a wrapper. Since TextInput doesn't directly support data attributes on the wrapper, wrap each input in a div:

Replace the formGrid contents. Find:
```typescript
            <div className={classes.formGrid}>
              <TextInput
                label="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="OAuth client ID"
                styles={inputStyles}
                required
              />
              <TextInput
                label="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="OAuth client secret"
                type="password"
                styles={inputStyles}
                required
              />
              <TextInput
                label={selectedProvider.projectKeyLabel}
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder={selectedProvider.projectKeyPlaceholder}
                styles={inputStyles}
                required
              />
              {(selectedProvider.requiresBaseUrl || selectedProvider.type !== "github_projects") && (
                <TextInput
                  label={`Base URL${selectedProvider.requiresBaseUrl ? "" : " (optional)"}`}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    selectedProvider.type === "youtrack"
                      ? "https://youtrack.example.com"
                      : "https://your-domain.atlassian.net"
                  }
                  styles={inputStyles}
                  required={selectedProvider.requiresBaseUrl}
                />
              )}
            </div>
```

Replace with:
```typescript
            <div className={classes.formGrid}>
              <div data-tour="bugs-client-id">
                <TextInput
                  label="Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="OAuth client ID"
                  styles={inputStyles}
                  required
                />
              </div>
              <div data-tour="bugs-client-secret">
                <TextInput
                  label="Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="OAuth client secret"
                  type="password"
                  styles={inputStyles}
                  required
                />
              </div>
              <div data-tour="bugs-project-key">
                <TextInput
                  label={selectedProvider.projectKeyLabel}
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                  placeholder={selectedProvider.projectKeyPlaceholder}
                  styles={inputStyles}
                  required
                />
              </div>
              {(selectedProvider.requiresBaseUrl || selectedProvider.type !== "github_projects") && (
                <div data-tour="bugs-base-url">
                  <TextInput
                    label={`Base URL${selectedProvider.requiresBaseUrl ? "" : " (optional)"}`}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={
                      selectedProvider.type === "youtrack"
                        ? "https://youtrack.example.com"
                        : "https://your-domain.atlassian.net"
                    }
                    styles={inputStyles}
                    required={selectedProvider.requiresBaseUrl}
                  />
                </div>
              )}
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/features/bugs/components/ProviderSetup.tsx
git commit -m "feat: add data-tour attributes to provider setup form"
```

## Chunk 3: UI Integration

### Task 12: Add Help Tour button to StatusBar

**Files:**
- Modify: `src/components/layout/StatusBar.tsx`

- [ ] **Step 1: Add the help tour button**

In `src/components/layout/StatusBar.tsx`, add imports:

```typescript
import { Bell, CircleHelp } from "lucide-react";
import { Group, Text, ActionIcon } from "@mantine/core";
```

Remove `Bell` from the existing lucide import if it's there, and add `CircleHelp`. Add `ActionIcon` to the Mantine import.

Add hook imports:
```typescript
import { useTour } from "@/hooks/useTour";
import { panelTours } from "@/constants/tours";
```

Modify the existing `useUiStore` destructuring from:
```typescript
  const { setActivePanel } = useUiStore();
```
To:
```typescript
  const { activePanel, setActivePanel } = useUiStore();
```

Then add after the existing hooks:
```typescript
  const { startPanelTour } = useTour();
  const hasTour = activePanel in panelTours;
```

Before the notification button (the `{/* Right: Notification badge */}` comment), add the help button:

```typescript
      {/* Right section */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {hasTour && (
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => startPanelTour(activePanel)}
            aria-label="Start help tour"
            title="Help tour"
            styles={{
              root: {
                color: "var(--text-secondary)",
                "&:hover": { color: "var(--text-primary)", backgroundColor: "transparent" },
              },
            }}
          >
            <CircleHelp size={12} />
          </ActionIcon>
        )}
        <button
          onClick={() => setActivePanel("notifications")}
          aria-label={`${unreadCount} unread notifications`}
          className={classes.notificationButton}
          data-tour="statusbar-notifications"
        >
          <Bell size={10} />
          {unreadCount > 0 && (
            <Text span fz={10} c="var(--danger)" fw={700}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          )}
        </button>
      </div>
```

Remove the old standalone notification button (the existing `{/* Right: Notification badge */}` section) since it's now inside the wrapper div.

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/StatusBar.tsx
git commit -m "feat: add help tour button to status bar"
```

### Task 13: Add Instructions button to ProviderSetup

**Files:**
- Modify: `src/features/bugs/components/ProviderSetup.tsx`

- [ ] **Step 1: Add the Instructions button**

In `src/features/bugs/components/ProviderSetup.tsx`, add imports:

```typescript
import { CircleHelp } from "lucide-react";
import { useTour } from "@/hooks/useTour";
import {
  jiraSetupTour,
  githubSetupTour,
  youtrackSetupTour,
  genericSetupTour,
} from "@/constants/tours";
```

Inside the component function, add:

```typescript
  const { startTour } = useTour();

  const handleInstructions = () => {
    if (!selectedProvider) {
      startTour(genericSetupTour);
      return;
    }
    const tourMap: Record<string, typeof jiraSetupTour> = {
      jira: jiraSetupTour,
      github_projects: githubSetupTour,
      youtrack: youtrackSetupTour,
    };
    startTour(tourMap[selectedProvider.type] ?? genericSetupTour);
  };
```

In the header section (after the subtitle paragraph on line 138), add the Instructions button:

Find:
```typescript
          <p className={classes.subtitle}>
            Choose a provider, enter your OAuth credentials, then authenticate to sync issues.
          </p>
```

After it, add:
```typescript
          <button
            type="button"
            onClick={handleInstructions}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            <CircleHelp size={14} />
            Instructions
          </button>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/bugs/components/ProviderSetup.tsx
git commit -m "feat: add Instructions button to provider setup with per-provider tours"
```

### Task 14: Add first-start auto-tour to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the auto-tour on first start**

In `src/App.tsx`, add `useRef` to the existing React import:

```typescript
import { useEffect, useRef } from "react";
```

Add new imports:

```typescript
import { useTour } from "@/hooks/useTour";
import { useTourStore } from "@/stores/tourStore";
```

Inside the `App` component, add after the existing hooks:

```typescript
  const { startHomeTour } = useTour();
  const { hasSeenHomeTour, setHomeTourSeen } = useTourStore();
```

Add a new useEffect after the existing ones (after the `beforeunload` effect):

```typescript
  const hasSeenHomeTourRef = useRef(hasSeenHomeTour);
  useEffect(() => {
    if (hasSeenHomeTourRef.current) return;

    const timeout = setTimeout(() => {
      startHomeTour(setHomeTourSeen);
    }, 800);

    return () => clearTimeout(timeout);
  }, [startHomeTour, setHomeTourSeen]);
```

Note: We use a ref for `hasSeenHomeTour` to avoid re-triggering when the value changes (after tour completes), while keeping the other deps in the array to satisfy ESLint. Add `useRef` to the React import.

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/szymon-grzybek/Projects/ove.run && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: auto-trigger home tour on first app start"
```

## Chunk 4: Verification

### Task 15: Build verification

- [ ] **Step 1: Run full build**

Run: `cd /home/szymon-grzybek/Projects/ove.run && pnpm build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 2: Fix any build issues**

If there are type errors or build failures, fix them and re-commit.

- [ ] **Step 3: Verify the app launches**

Run: `cd /home/szymon-grzybek/Projects/ove.run && pnpm tauri dev &` and check there are no console errors related to tours.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build issues from tour integration"
```
