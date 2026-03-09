# Rich-Text Preview Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the raw-textarea editable preview with a TipTap rich-text editor backed by markdown source, and fix header layout at narrow widths.

**Architecture:** New `RichTextEditor` component wraps TipTap with markdown serialization via `tiptap-markdown`. `MarkdownEditorWorkspace` renders `RichTextEditor` in Preview/Split panes, dispatching toolbar commands to TipTap when it's active. `MarkdownPreview` becomes read-only. Header layout simplified by removing metrics rail and fixing mode toggle alignment.

**Tech Stack:** TipTap (ProseMirror), tiptap-markdown, React, CSS Modules

---

### Task 1: Install TipTap Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder tiptap-markdown @tiptap/pm
```

**Step 2: Verify install**

Run: `pnpm build`
Expected: compiles without errors

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add tiptap dependencies for rich-text preview editor"
```

---

### Task 2: Create RichTextEditor Component

**Files:**
- Create: `src/components/shared/RichTextEditor.tsx`
- Create: `src/components/shared/RichTextEditor.module.css`

**Step 1: Create `RichTextEditor.tsx`**

The component:
- Accepts `content` (markdown string), `onContentChange`, `className`, `placeholder`
- Initializes TipTap with extensions: StarterKit, Underline, Link, TaskList, TaskItem, Placeholder
- Uses `tiptap-markdown` for markdown ↔ ProseMirror conversion
- Exposes the editor instance via `onEditorReady` callback so the parent can dispatch toolbar commands
- Debounces `onContentChange` calls by ~150ms to avoid thrashing in Split mode
- Handles `Mod+Enter` as a save shortcut via `onSave` prop

Extensions config:
```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
```

StarterKit includes: paragraphs, headings (1-6), bold, italic, strike, code, codeBlock, blockquote, bulletList, orderedList, horizontalRule, hardBreak.

Link config: `openOnClick: false, autolink: true`
TaskItem config: `nested: false`
Markdown config: `html: true` (for `<u>` underline round-trip)

**Step 2: Create `RichTextEditor.module.css`**

Style the `.ProseMirror` output to match existing `MarkdownPreview.module.css` typography:
- Same heading sizes (h1: 2.25em, h2: 1.58em, h3: 1.22em, etc.), weights, letter-spacing
- Same paragraph line-height (1.85), margins
- Same code block styling (rounded, bg gradient, border)
- Same inline code pill styling
- Same blockquote left-border + gradient bg
- Same list styling, task list checkboxes
- Same hr styling
- Root: padding `42px clamp(24px, 4vw, 56px) 56px`, max-width 72ch auto-centered
- Caret: `caret-color: var(--accent-glow)`
- Placeholder: `color: var(--text-tertiary)`

**Step 3: Verify**

Run: `pnpm build`
Expected: compiles without errors (component not mounted yet)

**Step 4: Commit**

```bash
git add src/components/shared/RichTextEditor.tsx src/components/shared/RichTextEditor.module.css
git commit -m "feat: create RichTextEditor component with TipTap and markdown sync"
```

---

### Task 3: Integrate RichTextEditor into MarkdownEditorWorkspace

**Files:**
- Modify: `src/components/shared/MarkdownEditorWorkspace.tsx`

**Step 1: Replace preview pane content**

In `MarkdownEditorWorkspace.tsx`:
- Import `RichTextEditor` and store the TipTap `Editor` instance in a ref
- In the preview/split pane, replace `<MarkdownPreview>` with `<RichTextEditor>`
- Pass `content`, `onContentChange`, `placeholder`, `onEditorReady` (stores editor ref)
- When the TipTap editor is active, `handleFormat` should dispatch TipTap commands instead of `applyFormatting`:
  - h1/h2/h3 → `editor.chain().focus().toggleHeading({ level }).run()`
  - bold → `editor.chain().focus().toggleBold().run()`
  - italic → `editor.chain().focus().toggleItalic().run()`
  - underline → `editor.chain().focus().toggleUnderline().run()`
  - strike → `editor.chain().focus().toggleStrike().run()`
  - code → `editor.chain().focus().toggleCode().run()`
  - blockquote → `editor.chain().focus().toggleBlockquote().run()`
  - checkbox → `editor.chain().focus().toggleTaskList().run()`
  - link → `editor.chain().focus().toggleLink({ href: '' }).run()` (or prompt for URL)
- Remove the `ActiveEditor` ref/state machinery (no longer needed for preview pane)
- Remove the `MarkdownPreview` import (no longer used in this file)

**Step 2: Remove metrics rail from JSX**

Delete the entire `.metricsRail` section (lines ~451-470 in current file). The summary row under the title already shows word/line/character counts.

**Step 3: Verify**

Run: `pnpm dev` → open Knowledge or Notes, select an entry, switch to Preview and Split modes
Expected: TipTap rich-text editor renders formatted content, typing works, toolbar buttons apply formatting, changes sync back to markdown

**Step 4: Commit**

```bash
git add src/components/shared/MarkdownEditorWorkspace.tsx
git commit -m "feat: integrate TipTap rich-text editor in preview and split modes"
```

---

### Task 4: Fix Header Layout

**Files:**
- Modify: `src/components/shared/MarkdownEditorWorkspace.module.css`

**Step 1: Fix headerActions alignment**

Current issue: at `max-width: 1280px`, `justify-content` switches to `flex-start`, pushing mode toggle left.

Fix `.headerActions`:
- Use `justify-content: flex-end` at all widths (remove the `flex-start` override in media queries)
- Give `.modeToggle` `margin-right: auto` so it pushes save/close buttons to the right while staying left-anchored — or center it with a spacer approach
- Better approach: make `.headerActions` always use a left/center/right layout:
  - `.unsaved` label on the left
  - `.modeToggle` in the center (with `margin: 0 auto`)
  - Save + Close buttons on the right

Remove the `metricsRail` and `metricCard` CSS rules entirely.

At `max-width: 720px`: reduce padding but keep the same layout structure. The mode toggle naturally wraps if too wide.

**Step 2: Remove media query overrides that break alignment**

In the `@media (max-width: 1280px)` block, remove `justify-content: flex-start` from `.headerActions`.
In the `@media (max-width: 720px)` block, remove `justify-content: flex-start` from `.headerActions`.

**Step 3: Verify**

Run: `pnpm dev` → resize window from ~1400px down to ~700px
Expected: mode toggle stays visually centered/consistent, save/close buttons stay right, no awkward jumping

**Step 4: Commit**

```bash
git add src/components/shared/MarkdownEditorWorkspace.module.css
git commit -m "fix: header layout alignment at narrow widths, remove metrics rail"
```

---

### Task 5: Clean Up MarkdownPreview (Read-Only Only)

**Files:**
- Modify: `src/components/shared/MarkdownPreview.tsx`
- Modify: `src/components/shared/MarkdownPreview.module.css`

**Step 1: Remove editable machinery from MarkdownPreview.tsx**

- Remove `EditableBlock` component entirely
- Remove `InsertBlockComposer` component entirely
- Remove `ActiveEditor` type and re-export
- Remove `insertMarkdownBlock` helper
- Remove `splitMarkdownLines` helper (if only used by editable code)
- Remove `onContentChange`, `onActiveEditorChange` from `MarkdownPreviewProps`
- Remove `editable` logic from `MarkdownPreview` component — always render read-only
- Keep: `parseBlocks`, `renderInline`, `CheckboxToggle` (checkboxes can still toggle in read-only if desired, or remove too)
- Keep: `getBlockTextareaClassName` only if still used — likely remove

The component becomes a simple read-only markdown renderer.

**Step 2: Remove editable styles from MarkdownPreview.module.css**

Remove these classes:
- `.editableRoot`
- `.editableBlock` + hover/focus states
- `.editingBlock`
- `.insertZone` + all variants (`.insertZoneVisible`, hover states)
- `.insertLine` + hover states
- `.insertLabel` + `::before`
- `.blockTextarea` and all variants (`.blockTextareaProse`, `.blockTextareaQuote`, `.blockTextareaMono`, `.blockTextareaHeading1`–`6`)

Keep all typography styles (`.h1`–`.h6`, `.p`, `.codeBlock`, `.blockquote`, etc.).

**Step 3: Verify**

Run: `pnpm build`
Expected: compiles without errors, no unused imports/types

**Step 4: Commit**

```bash
git add src/components/shared/MarkdownPreview.tsx src/components/shared/MarkdownPreview.module.css
git commit -m "refactor: strip editable machinery from MarkdownPreview, keep read-only renderer"
```

---

### Task 6: Final Verification & Cleanup

**Step 1: Full build check**

Run: `pnpm build`
Expected: no TypeScript errors, no unused imports

**Step 2: Manual smoke test**

Run: `pnpm tauri dev`

Test these scenarios:
1. Knowledge panel → select entry → Write mode: raw textarea works, toolbar formats markdown
2. Switch to Preview: TipTap renders formatted content, typing works inline, Ctrl+B toggles bold, toolbar buttons work
3. Switch to Split: left textarea + right TipTap, changes in either sync to the other
4. Notes panel → same tests with title editing
5. Resize window to ~800px: header stays aligned, mode toggle doesn't jump left
6. Create new entry, type content, save — verify markdown persists correctly

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup for rich-text preview editor"
```
