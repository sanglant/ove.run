import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { createRoot } from "react-dom/client";
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

// --- Suggestion render factory ---

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
    <div className={`${styles.promptEditor} ${className ?? ""}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
