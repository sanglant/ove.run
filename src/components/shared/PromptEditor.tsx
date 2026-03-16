import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { createRoot } from "react-dom/client";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Code,
  List,
  ListOrdered,
  ListTodo,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import styles from "./RichTextEditor.module.css";

const fileMentionPluginKey = new PluginKey("fileMention");
const skillMentionPluginKey = new PluginKey("skillMention");

// --- Types ---

export interface SuggestionItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
}

// --- Autocomplete menu with scroll-into-view and mousedown close ---

interface AutocompleteMenuProps {
  items: SuggestionItem[];
  onSelect: (item: SuggestionItem) => void;
  selectedIndex: number;
}

function AutocompleteMenu({ items, onSelect, selectedIndex }: AutocompleteMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the active item into view on every selectedIndex change
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div className={styles.slashMenu} ref={listRef}>
      {items.length === 0 && (
        <div className={styles.slashEmpty}>No results</div>
      )}
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          data-active={index === selectedIndex}
          className={`${styles.slashItem} ${index === selectedIndex ? styles.slashItemActive : ""}`}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent blur before selection fires
            onSelect(item);
          }}
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

// --- Suggestion render factory ---

function createSuggestionRenderer() {
  let popup: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let selectedIndex = 0;
  let currentItems: SuggestionItem[] = [];
  let currentCommand: ((item: SuggestionItem) => void) | null = null;
  let onClickOutside: ((e: MouseEvent) => void) | null = null;

  function cleanup() {
    if (onClickOutside) {
      document.removeEventListener("mousedown", onClickOutside, true);
      onClickOutside = null;
    }
    if (root) { root.unmount(); root = null; }
    if (popup) { popup.remove(); popup = null; }
    selectedIndex = 0;
    currentItems = [];
    currentCommand = null;
  }

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
      popup.style.position = "fixed";
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

      // Close on click outside the popup
      onClickOutside = (e: MouseEvent) => {
        if (popup && !popup.contains(e.target as Node)) {
          // Delete the trigger text and close
          props.editor.commands.focus();
          cleanup();
        }
      };
      // Use setTimeout so the opening click doesn't immediately close it
      setTimeout(() => {
        if (onClickOutside) {
          document.addEventListener("mousedown", onClickOutside, true);
        }
      }, 0);
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
    onExit: cleanup,
  };
}

// --- Extension factories ---

function createFileMention(filesRef: React.RefObject<SuggestionItem[]>) {
  return Extension.create({
    name: "fileMention",
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionItem, SuggestionItem>({
          pluginKey: fileMentionPluginKey,
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
          pluginKey: skillMentionPluginKey,
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
            // Insert the slug (stored in id) not the display title
            editor.chain().focus().deleteRange(range).insertContent(`/${item.id} `).run();
          },
          render: createSuggestionRenderer,
        }),
      ];
    },
  });
}

// --- Mini toolbar for the prompt editor ---

function PromptToolbar({ editor }: { editor: Editor }) {
  return (
    <div className={styles.promptToolbar}>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("bold") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        title="Bold"
      >
        <Bold size={13} />
      </button>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("italic") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        title="Italic"
      >
        <Italic size={13} />
      </button>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("underline") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
        title="Underline"
      >
        <UnderlineIcon size={13} />
      </button>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("code") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
        title="Inline code"
      >
        <Code size={13} />
      </button>
      <span className={styles.promptToolbarDivider} />
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("bulletList") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        title="Bullet list"
      >
        <List size={13} />
      </button>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("orderedList") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        title="Ordered list"
      >
        <ListOrdered size={13} />
      </button>
      <button
        type="button"
        className={`${styles.promptToolbarBtn} ${editor.isActive("taskList") ? styles.promptToolbarBtnActive : ""}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }}
        title="Task list"
      >
        <ListTodo size={13} />
      </button>
    </div>
  );
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
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false }),
      fileMention.current,
      skillMention.current,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const md = (editor.storage as Record<string, any>).markdown.getMarkdown() as string;
      onChangeRef.current(md);
    },
  });

  return (
    <div className={`${styles.promptEditor} ${className ?? ""}`}>
      {editor && <PromptToolbar editor={editor} />}
      <div className={styles.promptEditorBody}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
