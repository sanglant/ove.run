# Rich-Text Preview Editor & Header Layout Fix

## Problem

1. Preview edit mode uses raw markdown textareas inline — jarring visual shift from rendered content
2. Editor workspace header layout misaligns at narrow widths (~900px and below), mode toggle pushed left awkwardly

## Design

### TipTap Integration

Replace the editable preview mode with a TipTap-powered rich-text editor backed by markdown source.

**Architecture:**
- New `RichTextEditor` component wraps TipTap, accepts markdown string, syncs changes back to markdown
- `MarkdownEditorWorkspace` uses `RichTextEditor` in Preview and Split panes (replacing editable `MarkdownPreview`)
- `MarkdownPreview` becomes read-only only (editable machinery removed)
- Markdown string remains single source of truth
- Toolbar dispatches TipTap commands when rich editor is active, raw textarea formatting when Write mode is active

**Extensions:** StarterKit, Underline, Link, TaskList, TaskItem, Placeholder, tiptap-markdown

**Keyboard shortcuts:** Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Shift+X strike, Ctrl+E code, Ctrl+Shift+7/8/9 lists, Mod+Enter save

**Markdown round-trip:** tiptap-markdown for serialization/deserialization, debounced ~150ms on change

**Skipped for now:** Mermaid rendering inside TipTap, images, tables

### Styling

- Reuse existing MarkdownPreview typography styles scoped to ProseMirror output
- Same padding, max-width 72ch, line-height, background
- Remove per-block edit/insert zone machinery

### Header Layout Fix

- Keep mode toggle centered with `margin: 0 auto` at all widths
- Unsaved label left, Save/Close right
- Remove metrics rail (duplicates summary row)
- Compact padding below 720px

## Files

**New:** `RichTextEditor.tsx`, `RichTextEditor.module.css`
**Modified:** `MarkdownEditorWorkspace.tsx/.css`, `MarkdownPreview.tsx/.css`
**Unchanged:** `KnowledgeEditor.tsx`, `KnowledgePanel.tsx`, `NotesPanel.tsx`, `uiStore.ts`

## Dependencies

`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-placeholder`, `tiptap-markdown`
