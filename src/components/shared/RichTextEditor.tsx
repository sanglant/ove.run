import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { createRoot } from "react-dom/client";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Code2,
} from "lucide-react";
import styles from "./RichTextEditor.module.css";

export interface RichTextEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  onSave?: () => void;
}

// ---------------------------------------------------------------------------
// Slash command items
// ---------------------------------------------------------------------------

interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (editor: Editor, range: { from: number; to: number }) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Unordered list of items",
    icon: <List size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Ordered List",
    description: "Numbered list of items",
    icon: <ListOrdered size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "List with checkboxes",
    icon: <ListTodo size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Blockquote",
    description: "Indented quote block",
    icon: <Quote size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Fenced code snippet",
    icon: <Code2 size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: "Horizontal Rule",
    description: "Visual divider line",
    icon: <Minus size={18} />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

// ---------------------------------------------------------------------------
// Slash menu React component (rendered into a portal)
// ---------------------------------------------------------------------------

interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  selectedIndex: number;
}

function SlashMenu({ items, command, selectedIndex }: SlashMenuProps) {
  return (
    <div className={styles.slashMenu}>
      {items.length === 0 && (
        <div className={styles.slashEmpty}>No results</div>
      )}
      {items.map((item, index) => (
        <button
          type="button"
          key={item.title}
          className={`${styles.slashItem} ${index === selectedIndex ? styles.slashItemActive : ""}`}
          onClick={() => command(item)}
        >
          <span className={styles.slashItemIcon}>{item.icon}</span>
          <span className={styles.slashItemText}>
            <span className={styles.slashItemTitle}>{item.title}</span>
            <span className={styles.slashItemDescription}>
              {item.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slash command TipTap extension
// ---------------------------------------------------------------------------

const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_COMMANDS.filter((item) =>
            item.title.toLowerCase().includes(q),
          );
        },
        command: ({ editor, range, props: item }) => {
          item.command(editor, range);
        },
        render: () => {
          let popup: HTMLDivElement | null = null;
          let root: ReturnType<typeof createRoot> | null = null;
          let selectedIndex = 0;
          let currentItems: SlashCommandItem[] = [];
          let currentCommand: ((item: SlashCommandItem) => void) | null = null;

          function renderMenu() {
            if (!root || !currentCommand) return;
            root.render(
              <SlashMenu
                items={currentItems}
                command={currentCommand}
                selectedIndex={selectedIndex}
              />,
            );
          }

          return {
            onStart: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
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

            onUpdate: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
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
                selectedIndex =
                  (selectedIndex - 1 + currentItems.length) %
                  Math.max(1, currentItems.length);
                renderMenu();
                return true;
              }
              if (event.key === "Enter") {
                if (currentItems[selectedIndex] && currentCommand) {
                  currentCommand(currentItems[selectedIndex]);
                }
                return true;
              }
              if (event.key === "Escape") {
                return true;
              }
              return false;
            },

            onExit: () => {
              if (root) {
                root.unmount();
                root = null;
              }
              if (popup) {
                popup.remove();
                popup = null;
              }
              selectedIndex = 0;
              currentItems = [];
              currentCommand = null;
            },
          };
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Bubble toolbar
// ---------------------------------------------------------------------------

function BubbleToolbar({ editor }: { editor: Editor }) {
  return (
    <div className={styles.bubbleMenu}>
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("bold") ? styles.bubbleBtnActive : ""}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("italic") ? styles.bubbleBtnActive : ""}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("underline") ? styles.bubbleBtnActive : ""}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon size={14} />
      </button>
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("strike") ? styles.bubbleBtnActive : ""}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough size={14} />
      </button>
      <span className={styles.bubbleDivider} />
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("code") ? styles.bubbleBtnActive : ""}`}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code size={14} />
      </button>
      <button
        type="button"
        className={`${styles.bubbleBtn} ${editor.isActive("link") ? styles.bubbleBtnActive : ""}`}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
          } else {
            const url = window.prompt("URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        title="Link"
      >
        <LinkIcon size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor component
// ---------------------------------------------------------------------------

export function RichTextEditor({
  content,
  onContentChange,
  className,
  placeholder = "Type '/' for commands\u2026",
  onEditorReady,
  onSave,
}: RichTextEditorProps) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const isExternalUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: true }),
      SlashCommands,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        const md = (editor.storage as Record<string, any>).markdown.getMarkdown() as string;
        onContentChangeRef.current(md);
      }, 150);
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSaveRef.current?.();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  const prevContentRef = useRef(content);
  useEffect(() => {
    if (!editor) return;
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;

    const currentMd = (editor.storage as Record<string, any>).markdown.getMarkdown() as string;
    if (currentMd === content) return;

    isExternalUpdate.current = true;
    editor.commands.setContent(content);
    isExternalUpdate.current = false;
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        if (editor) {
          const md = (editor.storage as Record<string, any>).markdown.getMarkdown() as string;
          onContentChangeRef.current(md);
        }
      }
    };
  }, [editor]);

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      {editor && (
        <BubbleMenu editor={editor}>
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
