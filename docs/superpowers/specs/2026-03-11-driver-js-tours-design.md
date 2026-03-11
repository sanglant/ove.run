# Interactive Documentation Tours (driver.js)

## Overview

Add interactive guided tours using driver.js to document app features. Includes a first-start tour, per-panel help tours triggered from the footer, and provider-specific setup instruction tours in the bug tracker.

## Architecture

### Core Infrastructure

**`src/hooks/useTour.ts`** — Custom hook wrapping driver.js:
- Initializes `driver()` with dark-themed config using CSS variables from `theme.ts`
- Uses `onPopoverRender` to replace default popover content with Mantine components (`Paper`, `Text`, `Button`, `Group`, progress indicator)
- Exposes `startTour(panelName: string)` and `isRunning` state
- On tour completion, marks the panel as "seen" in settings store

**`src/constants/tours/`** — Tour config directory with one file per tour:
- `home.ts` — First-start tour (9 steps)
- `terminal.ts` — Terminal panel tour
- `git.ts` — Git panel tour
- `knowledge.ts` — Knowledge panel tour
- `notes.ts` — Notes panel tour
- `bugs.ts` — Bugs panel tour (usage after setup)
- `bugSetup.ts` — Provider setup instructions (Jira/GitHub/YouTrack)

Each config exports a `DriveStep[]` array with `element` selectors (using `data-tour` attributes), popover content (title + description), and positioning.

**`src/styles/tour.css`** — Dark theme overrides for driver.js:
- Popover background: `var(--bg-secondary)`
- Text: `var(--text-primary)` / `var(--text-secondary)`
- Border: `var(--border-primary)`
- Overlay: semi-transparent dark
- Buttons rendered as Mantine `Button` components via `onPopoverRender`

### Data Attributes

Components participating in tours get `data-tour` attributes as selectors (e.g., `data-tour="sidebar-project-list"`, `data-tour="terminal-tabs"`). This avoids coupling to fragile CSS class selectors.

## First-Start Auto-Tour

### Detection

`hasSeenHomeTour: boolean` added to `settingsStore.ts` (persisted). Defaults to `false`.

### Trigger

In `App.tsx`, on mount: if `hasSeenHomeTour` is `false`, start the home tour after a short delay (let UI render). On tour completion (`onDestroyed` callback), set `hasSeenHomeTour: true`.

### Home Tour Steps (9 steps)

1. **Project list area** (`data-tour="sidebar-project-list"`) — "Create projects to organize your agent sessions"
2. **Terminal panel icon** (`data-tour="sidebar-terminal"`) — "Run AI agent sessions in the terminal"
3. **Git panel icon** (`data-tour="sidebar-git"`) — "View repository status, diffs, and make commits"
4. **Knowledge panel icon** (`data-tour="sidebar-knowledge"`) — "Manage system prompts and context files for agents"
5. **Notes panel icon** (`data-tour="sidebar-notes"`) — "Keep project notes and documentation"
6. **Bugs panel icon** (`data-tour="sidebar-bugs"`) — "Track and delegate bugs from Jira, GitHub, or YouTrack"
7. **Settings icon** (`data-tour="sidebar-settings"`) — "Configure app preferences, guardian provider, and more"
8. **Guardian toggle** (`data-tour="sidebar-guardian"`) — "Guardian auto-answers agent questions using AI"
9. **Notification bell** (`data-tour="statusbar-notifications"`) — "Get notified about agent activity and guardian decisions"

## StatusBar Help Tour Button

### Location

In `StatusBar.tsx`, right section, before the notification bell.

### Behavior

- Mantine `ActionIcon` or compact `Button` with `CircleHelp` icon (lucide-react)
- Always visible (every panel has a tour)
- Clicking calls `startTour(activePanel)` from `useTour` hook
- `activePanel` from `useUiStore`

## Per-Panel Tours

### Terminal

1. **Terminal tabs** (`data-tour="terminal-tabs"`) — "Switch between agent sessions"
2. **Layout toggle** (`data-tour="terminal-layout"`) — "Change terminal layout (single, split, grid)"
3. **New session button** (`data-tour="terminal-new-session"`) — "Start a new agent session"

### Git

1. **File status list** (`data-tour="git-file-list"`) — "See changed files and their status"
2. **Diff viewer** (`data-tour="git-diff"`) — "Review changes before committing"
3. **Commit form** (`data-tour="git-commit"`) — "Stage files and create commits"

### Knowledge

1. **File list** (`data-tour="knowledge-file-list"`) — "Manage context files loaded into agent sessions"
2. **Editor area** (`data-tour="knowledge-editor"`) — "Edit system prompts and knowledge documents"

### Notes

1. **Notes list** (`data-tour="notes-list"`) — "Organize notes per project"
2. **Editor** (`data-tour="notes-editor"`) — "Rich text editor with markdown support"

### Bugs

1. **Bug list** (`data-tour="bugs-list"`) — "Browse and search bugs from your provider"
2. **Bug detail view** (`data-tour="bugs-detail"`) — "View full bug details, status, and priority"
3. **Delegate button** (`data-tour="bugs-delegate"`) — "Send a bug to an agent for fixing"
4. **Refresh button** (`data-tour="bugs-refresh"`) — "Sync latest bugs from provider"

## Provider Setup Instructions Tours

### Instructions Button

On the `ProviderSetup` screen: Mantine `Button` with `CircleHelp` icon, near the top of the form. Dynamically picks the tour based on selected provider. If no provider selected, runs generic tour starting from provider selection.

### Jira Tour

1. **Provider selector** (`data-tour="bugs-provider-select"`) — "Select Jira as your bug tracker"
2. **Client ID field** (`data-tour="bugs-client-id"`) — "Go to developer.atlassian.com → Profile icon → Developer console → Create → OAuth 2.0 integration. Then go to Settings in the left menu to find your Client ID"
3. **Client Secret field** (`data-tour="bugs-client-secret"`) — "On the same Settings page in your Atlassian Developer Console, copy the Client Secret"
4. **Project Key field** (`data-tour="bugs-project-key"`) — "Your project key is the prefix before issue numbers (e.g., PROJ in PROJ-123). Find it under Projects in Jira's top navigation"

### GitHub Issues Tour

1. **Provider selector** (`data-tour="bugs-provider-select"`) — "Select GitHub Issues"
2. **Client ID field** (`data-tour="bugs-client-id"`) — "Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. After registering, the Client ID is shown on the app page"
3. **Client Secret field** (`data-tour="bugs-client-secret"`) — "On your OAuth App page, click 'Generate a new client secret'. Copy it immediately — it won't be shown again"
4. **Project Key field** (`data-tour="bugs-project-key"`) — "Enter as owner/repo (e.g., octocat/Hello-World) — read directly from your repository URL: github.com/{owner}/{repo}"

### YouTrack Tour

1. **Provider selector** (`data-tour="bugs-provider-select"`) — "Select YouTrack"
2. **Base URL field** (`data-tour="bugs-base-url"`) — "Enter your YouTrack instance URL (e.g., https://myteam.youtrack.cloud)"
3. **Client ID field** (`data-tour="bugs-client-id"`) — "In YouTrack, go to Administration → Server Settings → Services → New service. After creation, find the Service ID (Client ID) on the service's Settings tab"
4. **Client Secret field** (`data-tour="bugs-client-secret"`) — "On the same Settings tab of your service in Hub, copy the Secret. You can regenerate it with the Change button"
5. **Project Key field** (`data-tour="bugs-project-key"`) — "The project short name appears as a prefix in issue IDs (e.g., XT in XT-123). Find it under Projects in YouTrack"

## Files to Create

- `src/hooks/useTour.ts`
- `src/styles/tour.css`
- `src/constants/tours/home.ts`
- `src/constants/tours/terminal.ts`
- `src/constants/tours/git.ts`
- `src/constants/tours/knowledge.ts`
- `src/constants/tours/notes.ts`
- `src/constants/tours/bugs.ts`
- `src/constants/tours/bugSetup.ts`
- `src/constants/tours/index.ts`

## Files to Modify

- `src/stores/settingsStore.ts` — Add `hasSeenHomeTour` flag
- `src/App.tsx` — Auto-trigger home tour on first start
- `src/components/layout/StatusBar.tsx` — Add Help Tour button
- `src/components/layout/Sidebar.tsx` — Add `data-tour` attributes to panel icons
- `src/features/terminal/TerminalContainer.tsx` — Add `data-tour` attributes
- `src/features/git/GitPanel.tsx` — Add `data-tour` attributes
- `src/features/knowledge/KnowledgePanel.tsx` — Add `data-tour` attributes
- `src/features/notes/NotesPanel.tsx` — Add `data-tour` attributes
- `src/features/bugs/BugsPanel.tsx` — Add `data-tour` attributes
- `src/features/bugs/ProviderSetup.tsx` — Add Instructions button + `data-tour` attributes
