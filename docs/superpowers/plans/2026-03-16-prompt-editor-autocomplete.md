# Prompt Editor with Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<Textarea>` in the arbiter/loop section of NewAgentDialog with a lightweight TipTap-based prompt editor that has `@` autocomplete for project files/folders and `/` autocomplete for context skills.

**Architecture:** New `PromptEditor` component using TipTap with two Suggestion extensions (@ for files, / for skills). A new Rust command `list_project_files` walks the project directory respecting `.gitignore`. Files are fetched on dialog open and cached in component state. The editor outputs plain text with `@path` and `/skill` references preserved as literal text.

**Tech Stack:** TipTap (already installed), `@tiptap/suggestion` (already installed), `ignore` crate (new dep for .gitignore), existing context store for skills.

---

## Chunk 1: Backend — File Listing Command

### Task 1: Add `ignore` crate and `list_project_files` command

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands/project_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add `ignore` crate to Cargo.toml**

Add to `[dependencies]`:
```toml
ignore = "0.4"
```

- [ ] **Step 2: Implement `list_project_files` in project_commands.rs**

Add after the existing `update_project` function:

```rust
#[tauri::command]
pub async fn list_project_files(
    project_path: String,
    max_files: Option<usize>,
) -> Result<Vec<String>, AppError> {
    use ignore::WalkBuilder;
    use std::path::Path;

    let root = Path::new(&project_path);
    if !root.is_dir() {
        return Err(AppError::Other(format!("Not a directory: {}", project_path)));
    }

    let limit = max_files.unwrap_or(5000);
    let mut files: Vec<String> = Vec::new();

    let walker = WalkBuilder::new(root)
        .hidden(true)         // skip hidden files
        .git_ignore(true)     // respect .gitignore
        .git_global(true)
        .git_exclude(true)
        .max_depth(Some(8))
        .build();

    for entry in walker {
        if files.len() >= limit {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        // Skip the root itself
        if entry.path() == root {
            continue;
        }
        if let Ok(rel) = entry.path().strip_prefix(root) {
            files.push(rel.to_string_lossy().to_string());
        }
    }

    files.sort();
    Ok(files)
}
```

- [ ] **Step 3: Register command in lib.rs**

Add `list_project_files` to the import line and the `.invoke_handler(tauri::generate_handler![...])` list.

- [ ] **Step 4: Add frontend binding in tauri.ts**

```typescript
export async function listProjectFiles(projectPath: string, maxFiles?: number): Promise<string[]> {
  return invoke("list_project_files", { projectPath, maxFiles });
}
```

- [ ] **Step 5: Verify Rust compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/project_commands.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat: add list_project_files command for prompt autocomplete"
```

---

## Chunk 2: PromptEditor Component

### Task 2: Create PromptEditor with @ and / autocomplete

**Files:**
- Create: `src/components/shared/PromptEditor.tsx`
- Modify: `src/components/shared/RichTextEditor.module.css` (reuse existing `.slashMenu` styles)

The PromptEditor is a lightweight TipTap editor with:
- `StarterKit` configured for paragraphs only (no headings, no lists)
- `Placeholder` extension
- Two `Suggestion` extensions: `@` for files, `/` for skills
- No toolbar, no bubble menu, no block handles
- Outputs plain text via `editor.getText()`

- [ ] **Step 1: Create PromptEditor.tsx**

```tsx
import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { createRoot } from "react-dom/client";
import { FileText, BookOpen } from "lucide-react";
import styles from "./RichTextEditor.module.css";

// --- Types ---

interface SuggestionItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
}

// --- Shared autocomplete menu (reuses slashMenu CSS) ---

interface AutocompleteMenuProps {
  items: SuggestionItem[];
  onSelect: (item: SuggestionItem) => void;
  selectedIndex: number;
}

function AutocompleteMenu({ items, onSelect, selectedIndex }: AutocompleteMenuProps) {
  return (
    <div className={styles.slashMenu}>
      {items.length === 0 && (
        <div className={styles.slashEmpty}>No results</div>
      )}
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          className={`${styles.slashItem} ${index === selectedIndex ? styles.slashItemActive : ""}`}
          onClick={() => onSelect(item)}
        >
          <span className={styles.slashItemIcon}>{item.icon}</span>
          <span className={styles.slashItemText}>
            <span className={styles.slashItemTitle}>{item.title}</span>
            {item.description && (
              <span className={styles.slashItemDescription}>{item.description}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

// --- Suggestion render factory (shared by both @ and /) ---

function createSuggestionRenderer() {
  let popup: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let selectedIndex = 0;
  let currentItems: SuggestionItem[] = [];
  let currentCommand: ((item: SuggestionItem) => void) | null = null;

  function renderMenu() {
    if (!root || !currentCommand) return;
    root.render(
      <AutocompleteMenu
        items={currentItems}
        onSelect={currentCommand}
        selectedIndex={selectedIndex}
      />,
    );
  }

  return {
    onStart: (props: SuggestionProps<SuggestionItem, SuggestionItem>) => {
      popup = document.createElement("div");
      popup.style.position = "absolute";
      popup.style.zIndex = "9999";
      document.body.appendChild(popup);
      root = createRoot(popup);
      selectedIndex = 0;
      currentItems = props.items;
      currentCommand = props.command;
      if (props.clientRect) {
        const rect = props.clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      }
      renderMenu();
    },
    onUpdate: (props: SuggestionProps<SuggestionItem, SuggestionItem>) => {
      currentItems = props.items;
      currentCommand = props.command;
      selectedIndex = Math.min(selectedIndex, Math.max(0, currentItems.length - 1));
      if (popup && props.clientRect) {
        const rect = props.clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      }
      renderMenu();
    },
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % Math.max(1, currentItems.length);
        renderMenu();
        return true;
      }
      if (event.key === "ArrowUp") {
        selectedIndex = (selectedIndex - 1 + currentItems.length) % Math.max(1, currentItems.length);
        renderMenu();
        return true;
      }
      if (event.key === "Enter") {
        if (currentItems[selectedIndex] && currentCommand) {
          currentCommand(currentItems[selectedIndex]);
        }
        return true;
      }
      if (event.key === "Escape") return true;
      return false;
    },
    onExit: () => {
      if (root) { root.unmount(); root = null; }
      if (popup) { popup.remove(); popup = null; }
      selectedIndex = 0;
      currentItems = [];
      currentCommand = null;
    },
  };
}

// --- Extension factories ---

function createFileMention(filesRef: React.RefObject<SuggestionItem[]>) {
  return Extension.create({
    name: "fileMention",
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionItem, SuggestionItem>({
          editor: this.editor,
          char: "@",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return (filesRef.current ?? [])
              .filter((f) => f.title.toLowerCase().includes(q))
              .slice(0, 15);
          },
          command: ({ editor, range, props: item }) => {
            editor.chain().focus().deleteRange(range).insertContent(`@${item.title} `).run();
          },
          render: createSuggestionRenderer,
        }),
      ];
    },
  });
}

function createSkillMention(skillsRef: React.RefObject<SuggestionItem[]>) {
  return Extension.create({
    name: "skillMention",
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionItem, SuggestionItem>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return (skillsRef.current ?? [])
              .filter((s) => s.title.toLowerCase().includes(q))
              .slice(0, 15);
          },
          command: ({ editor, range, props: item }) => {
            editor.chain().focus().deleteRange(range).insertContent(`/${item.title} `).run();
          },
          render: createSuggestionRenderer,
        }),
      ];
    },
  });
}

// --- Main component ---

export interface PromptEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  files: SuggestionItem[];
  skills: SuggestionItem[];
  className?: string;
}

export function PromptEditor({
  value,
  onChange,
  placeholder = "What should the agent work on?",
  files,
  skills,
  className,
}: PromptEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const filesRef = useRef(files);
  filesRef.current = files;

  const skillsRef = useRef(skills);
  skillsRef.current = skills;

  const fileMention = useRef(createFileMention(filesRef));
  const skillMention = useRef(createSkillMention(skillsRef));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      fileMention.current,
      skillMention.current,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getText());
    },
  });

  // Sync external value changes
  const prevValue = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value === prevValue.current) return;
    prevValue.current = value;
    if (editor.getText() !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}

export type { SuggestionItem };
```

- [ ] **Step 2: Add prompt editor specific CSS**

Append to `RichTextEditor.module.css` — a class for the prompt editor container that constrains height and matches the input styling:

```css
/* ── Prompt editor (arbiter initial prompt) ──────────────────────────────── */

.promptEditor {
  border: 1px solid var(--border);
  border-radius: var(--mantine-radius-sm);
  background: var(--bg-tertiary);
  min-height: 60px;
  max-height: 160px;
  overflow-y: auto;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  cursor: text;
}

.promptEditor:focus-within {
  border-color: var(--accent);
}

.promptEditor .ProseMirror {
  outline: none;
  min-height: 40px;
}

.promptEditor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--text-secondary);
  pointer-events: none;
  float: left;
  height: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/PromptEditor.tsx src/components/shared/RichTextEditor.module.css
git commit -m "feat: create PromptEditor with @ file and / skill autocomplete"
```

---

## Chunk 3: Integration into NewAgentDialog

### Task 3: Wire up PromptEditor in the arbiter section

**Files:**
- Modify: `src/features/agents/components/NewAgentDialog.tsx`

- [ ] **Step 1: Add imports and data fetching**

Import `PromptEditor` and `listProjectFiles`, `listContextUnits`. Add state for file list and skill list. Fetch on dialog mount.

- [ ] **Step 2: Replace Textarea with PromptEditor**

Replace the `<Textarea>` for "Initial prompt (required)" with:

```tsx
<div>
  <Text size="xs" c="var(--text-secondary)" fw={500} mb={4}>
    Initial prompt (required)
  </Text>
  <PromptEditor
    value={initialPromptText}
    onChange={setInitialPromptText}
    placeholder="What should the agent work on? Use @ for files, / for skills"
    files={fileItems}
    skills={skillItems}
    className={promptEditorStyles.promptEditor}
  />
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/agents/components/NewAgentDialog.tsx
git commit -m "feat: integrate PromptEditor with autocomplete into arbiter dialog"
```
