import { useEffect, useRef, useCallback } from "react";
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
import type {
  SuggestionProps,
  SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
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
  Undo,
  Redo,
  Type,
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
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 1 })
        .run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 size={18} />,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 2 })
        .run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 size={18} />,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 3 })
        .run();
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
            onStart: (
              props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
            ) => {
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

            onUpdate: (
              props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
            ) => {
              currentItems = props.items;
              currentCommand = props.command;
              selectedIndex = Math.min(
                selectedIndex,
                Math.max(0, currentItems.length - 1),
              );

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
                selectedIndex =
                  (selectedIndex + 1) % Math.max(1, currentItems.length);
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
// Block handles extension — hover on row to show +/drag, transaction D&D
// ---------------------------------------------------------------------------

const blockHandlesKey = new PluginKey("blockHandles");

interface BlockInfo {
  el: Element;
  from: number;
  to: number;
}

function createBlockHandlesExtension(
  getEditor: () => Editor | null,
) {
  return Extension.create({
    name: "blockHandles",

    addProseMirrorPlugins() {
      let container: HTMLDivElement | null = null;
      let currentBlock: BlockInfo | null = null;
      let hideTimeout: ReturnType<typeof setTimeout> | null = null;
      let dragSourceBlock: BlockInfo | null = null;

      // Get the top-level block at a given Y coordinate by scanning children
      function blockAtY(
        editorDom: Element,
        y: number,
      ): Element | null {
        const children = editorDom.children;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          if (y >= rect.top && y <= rect.bottom) {
            return children[i];
          }
        }
        // If between blocks, find closest
        let closest: Element | null = null;
        let minDist = Infinity;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          const mid = (rect.top + rect.bottom) / 2;
          const dist = Math.abs(y - mid);
          if (dist < minDist) {
            minDist = dist;
            closest = children[i];
          }
        }
        return minDist < 30 ? closest : null;
      }

      function resolveBlock(
        blockEl: Element,
        view: any,
      ): BlockInfo | null {
        let pos: number;
        try {
          pos = view.posAtDOM(blockEl, 0);
        } catch {
          return null;
        }
        const $pos = view.state.doc.resolve(pos);
        let depth = $pos.depth;
        while (depth > 1) depth--;
        const node = $pos.node(depth);
        if (!node) return null;
        const from = $pos.before(depth);
        return { el: blockEl, from, to: from + node.nodeSize };
      }

      return [
        new Plugin({
          key: blockHandlesKey,
          view(editorView) {
            container = document.createElement("div");
            container.className = styles.blockHandleContainer;
            container.setAttribute("aria-hidden", "true");

            const rootEl = editorView.dom.closest(
              `.${styles.root}`,
            ) as HTMLElement | null;
            const mountTarget =
              rootEl ?? editorView.dom.parentElement ?? document.body;
            mountTarget.appendChild(container);

            // Create buttons
            const plusBtn = document.createElement("button");
            plusBtn.type = "button";
            plusBtn.className = styles.blockHandleBtn;
            plusBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

            const dragBtn = document.createElement("button");
            dragBtn.type = "button";
            dragBtn.className = `${styles.blockHandleBtn} ${styles.blockHandleDrag}`;
            dragBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>`;

            container.appendChild(dragBtn);
            container.appendChild(plusBtn);

            // --- Plus click: add block below + open slash menu ---
            plusBtn.addEventListener("mousedown", (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!currentBlock) return;
              const editor = getEditor();
              if (!editor) return;

              const { to } = currentBlock;
              const { tr, schema } = editor.view.state;
              const newTr = tr.insert(to, schema.nodes.paragraph.create());
              newTr.setSelection(TextSelection.create(newTr.doc, to + 1));
              editor.view.dispatch(newTr);
              editor.commands.focus();

              // Small delay so the cursor is placed before inserting "/"
              requestAnimationFrame(() => {
                editor.commands.insertContent("/");
              });
            });

            // --- Drag: mousedown starts tracking, mousemove repositions ---
            let isDragging = false;
            let dragOverlay: HTMLDivElement | null = null;
            let dropIndicator: HTMLDivElement | null = null;
            let dropTargetPos = -1;

            function getBlockAtClientY(clientY: number): BlockInfo | null {
              const blockEl = blockAtY(editorView.dom, clientY);
              if (!blockEl) return null;
              return resolveBlock(blockEl, editorView);
            }

            dragBtn.addEventListener("mousedown", (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!currentBlock) return;

              isDragging = true;
              dragSourceBlock = { ...currentBlock };
              dragSourceBlock.el.classList.add(styles.blockDragging);

              // Create drop indicator line
              dropIndicator = document.createElement("div");
              dropIndicator.className = styles.dropIndicator;
              mountTarget.appendChild(dropIndicator);

              // Create invisible overlay to capture all mouse events
              dragOverlay = document.createElement("div");
              dragOverlay.style.cssText =
                "position:fixed;inset:0;z-index:10000;cursor:grabbing;";
              document.body.appendChild(dragOverlay);

              const onMouseMove = (me: MouseEvent) => {
                if (!dragSourceBlock || !dropIndicator || !rootEl) return;

                const target = getBlockAtClientY(me.clientY);
                if (!target || target.from === dragSourceBlock.from) {
                  dropIndicator.style.opacity = "0";
                  dropTargetPos = -1;
                  return;
                }

                const targetRect = target.el.getBoundingClientRect();
                const rootRect = rootEl.getBoundingClientRect();
                const scrollArea = rootEl.querySelector(
                  `.${styles.editorScrollArea}`,
                ) as HTMLElement | null;
                const scrollOffset = scrollArea ? scrollArea.scrollTop : 0;

                // Drop above or below the target block
                const midY = (targetRect.top + targetRect.bottom) / 2;
                const insertBefore = me.clientY < midY;
                const lineY = insertBefore ? targetRect.top : targetRect.bottom;

                dropIndicator.style.top = `${lineY - rootRect.top + scrollOffset}px`;
                dropIndicator.style.left = `${targetRect.left - rootRect.left}px`;
                dropIndicator.style.width = `${targetRect.width}px`;
                dropIndicator.style.opacity = "1";

                dropTargetPos = insertBefore ? target.from : target.to;
              };

              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);

                if (dragSourceBlock) {
                  dragSourceBlock.el.classList.remove(styles.blockDragging);
                }
                if (dragOverlay) {
                  dragOverlay.remove();
                  dragOverlay = null;
                }
                if (dropIndicator) {
                  dropIndicator.remove();
                  dropIndicator = null;
                }

                // Perform the move via transaction
                if (
                  dragSourceBlock &&
                  dropTargetPos >= 0 &&
                  dropTargetPos !== dragSourceBlock.from &&
                  dropTargetPos !== dragSourceBlock.to
                ) {
                  const { state } = editorView;
                  const { from, to } = dragSourceBlock;
                  const node = state.doc.slice(from, to);

                  let tr = state.tr;
                  // If dropping after the source, delete first then insert
                  // If dropping before, insert first then delete
                  if (dropTargetPos > from) {
                    tr = tr.delete(from, to);
                    const adjustedPos = dropTargetPos - (to - from);
                    tr = tr.insert(adjustedPos, node.content);
                  } else {
                    tr = tr.insert(dropTargetPos, node.content);
                    const adjustedFrom = from + node.content.size;
                    const adjustedTo = to + node.content.size;
                    tr = tr.delete(adjustedFrom, adjustedTo);
                  }

                  editorView.dispatch(tr);
                }

                isDragging = false;
                dragSourceBlock = null;
                dropTargetPos = -1;
                hideHandles(true);
              };

              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            });

            // Keep handles visible when hovering them
            container.addEventListener("mouseenter", () => {
              if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
              }
            });
            container.addEventListener("mouseleave", () => {
              if (!isDragging) hideHandles();
            });

            // --- Position helpers ---
            function showHandles(block: BlockInfo) {
              if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
              }
              if (!container || !rootEl) return;

              currentBlock = block;

              const scrollArea = rootEl.querySelector(
                `.${styles.editorScrollArea}`,
              ) as HTMLElement | null;
              const rootRect = rootEl.getBoundingClientRect();
              const blockRect = block.el.getBoundingClientRect();
              const scrollOffset = scrollArea ? scrollArea.scrollTop : 0;

              const top = blockRect.top - rootRect.top + scrollOffset;
              const left = blockRect.left - rootRect.left - 52;

              container.style.top = `${top}px`;
              container.style.left = `${Math.max(2, left)}px`;
              container.style.opacity = "1";
              container.style.pointerEvents = "auto";
            }

            function hideHandles(immediate = false) {
              if (!container) return;
              if (isDragging) return;
              if (immediate) {
                container.style.opacity = "0";
                container.style.pointerEvents = "none";
                currentBlock = null;
                return;
              }
              hideTimeout = setTimeout(() => {
                if (container) {
                  container.style.opacity = "0";
                  container.style.pointerEvents = "none";
                }
                currentBlock = null;
              }, 300);
            }

            // --- Mouse tracking on scroll area to cover full width ---
            const scrollArea = rootEl?.querySelector(
              `.${styles.editorScrollArea}`,
            ) as HTMLElement | null;

            const onMouseMove = (e: MouseEvent) => {
              if (isDragging) return;
              const target = e.target as Element;
              if (container?.contains(target)) return;

              const blockEl = blockAtY(editorView.dom, e.clientY);
              if (!blockEl) return;

              const block = resolveBlock(blockEl, editorView);
              if (!block) return;

              showHandles(block);
            };

            const onMouseLeave = (e: MouseEvent) => {
              if (isDragging) return;
              const related = e.relatedTarget as Element | null;
              if (related && container?.contains(related)) return;
              hideHandles();
            };

            // Listen on the scroll area instead of just the editor DOM
            const listenTarget = scrollArea ?? editorView.dom;
            listenTarget.addEventListener("mousemove", onMouseMove);
            listenTarget.addEventListener("mouseleave", onMouseLeave);

            // Scroll sync
            const onScroll = () => {
              if (currentBlock) {
                const block = resolveBlock(currentBlock.el, editorView);
                if (block) showHandles(block);
                else hideHandles(true);
              }
            };
            scrollArea?.addEventListener("scroll", onScroll, { passive: true });

            return {
              destroy() {
                listenTarget.removeEventListener("mousemove", onMouseMove);
                listenTarget.removeEventListener("mouseleave", onMouseLeave);
                scrollArea?.removeEventListener("scroll", onScroll);
                if (hideTimeout) clearTimeout(hideTimeout);
                container?.remove();
                container = null;
                currentBlock = null;
              },
            };
          },
        }),
      ];
    },
  });
}

// ---------------------------------------------------------------------------
// Top toolbar
// ---------------------------------------------------------------------------

type TextStyleValue = "paragraph" | "h1" | "h2" | "h3";

function getActiveTextStyle(editor: Editor): TextStyleValue {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "paragraph";
}

function TopToolbar({ editor }: { editor: Editor }) {
  const activeStyle = getActiveTextStyle(editor);

  const setTextStyle = (value: TextStyleValue) => {
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else if (value === "h1") {
      editor.chain().focus().setHeading({ level: 1 }).run();
    } else if (value === "h2") {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (value === "h3") {
      editor.chain().focus().setHeading({ level: 3 }).run();
    }
  };

  return (
    <div
      className={styles.topToolbar}
      role="toolbar"
      aria-label="Text formatting"
    >
      <div className={styles.toolbarGroup}>
        <div className={styles.styleSelectWrapper}>
          <Type
            size={13}
            className={styles.styleSelectIcon}
            aria-hidden="true"
          />
          <select
            className={styles.styleSelect}
            value={activeStyle}
            onChange={(e) => setTextStyle(e.target.value as TextStyleValue)}
            aria-label="Text style"
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </div>
      </div>

      <span className={styles.toolbarDivider} aria-hidden="true" />

      <div
        className={styles.toolbarGroup}
        role="group"
        aria-label="Inline formatting"
      >
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("bold") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-pressed={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("italic") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-pressed={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("underline") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-pressed={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("strike") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-pressed={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("code") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-pressed={editor.isActive("code")}
          title="Inline code"
        >
          <Code size={14} />
        </button>
      </div>

      <span className={styles.toolbarDivider} aria-hidden="true" />

      <div
        className={styles.toolbarGroup}
        role="group"
        aria-label="Block formatting"
      >
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("bulletList") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-pressed={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("orderedList") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-pressed={editor.isActive("orderedList")}
          title="Ordered list"
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("taskList") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          aria-pressed={editor.isActive("taskList")}
          title="Task list"
        >
          <ListTodo size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("blockquote") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-pressed={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote size={14} />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("codeBlock") ? styles.toolbarBtnActive : ""}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-pressed={editor.isActive("codeBlock")}
          title="Code block"
        >
          <Code2 size={14} />
        </button>
      </div>

      <span className={styles.toolbarDivider} aria-hidden="true" />

      <div className={styles.toolbarGroup}>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editor.isActive("link") ? styles.toolbarBtnActive : ""}`}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt("URL:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          aria-pressed={editor.isActive("link")}
          title="Link"
        >
          <LinkIcon size={14} />
        </button>
      </div>

      <span className={styles.toolbarDivider} aria-hidden="true" />

      <div className={styles.toolbarGroup} role="group" aria-label="History">
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={14} />
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo size={14} />
        </button>
      </div>
    </div>
  );
}

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
  const isSelfUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const getEditor = useCallback(() => editorRef.current, []);

  const blockHandlesExtension = useRef(
    createBlockHandlesExtension(getEditor),
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        dropcursor: {
          color: "var(--accent)",
          width: 2,
        },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: true }),
      SlashCommands,
      blockHandlesExtension.current,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        const md = (
          editor.storage as Record<string, any>
        ).markdown.getMarkdown() as string;
        isSelfUpdate.current = true;
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

  editorRef.current = editor ?? null;

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

    // Skip if this content change was caused by our own onUpdate callback
    if (isSelfUpdate.current) {
      isSelfUpdate.current = false;
      return;
    }

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
          const md = (
            editor.storage as Record<string, any>
          ).markdown.getMarkdown() as string;
          onContentChangeRef.current(md);
        }
      }
    };
  }, [editor]);

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      {editor && <TopToolbar editor={editor} />}
      {editor && (
        <BubbleMenu editor={editor}>
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}
      <div className={styles.editorScrollArea}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
