/**
 * MarkdownEditorWorkspace — shared editor used by both Knowledge and Notes panels.
 *
 * Fully controlled: parent owns content + title state.
 *
 * Raw mode:      editable textarea.
 * Preview mode:  MarkdownPreview with click-to-edit blocks (editable preview).
 *
 * Both modes expose a formatting toolbar: H1–H3, Bold, Italic, Underline,
 * Strikethrough, inline Code, Blockquote, Checkbox, Link.
 *
 * The toolbar works in both modes by tracking which textarea is currently
 * focused (raw textarea or a preview block's inline textarea) via `activeEditorRef`.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Save, X, Eye, Code,
  Heading1, Heading2, Heading3,
  Bold, Italic, Underline, Strikethrough,
  Quote, Link, ListTodo,
} from "lucide-react";
import { ActionIcon, Button, Group, Text, Tooltip } from "@mantine/core";
import { MarkdownPreview, type ActiveEditor } from "./MarkdownPreview";
import styles from "./MarkdownEditorWorkspace.module.css";

export type ViewMode = "raw" | "markdown";

interface MarkdownEditorWorkspaceProps {
  /** Controlled content value */
  content: string;
  onContentChange: (value: string) => void;

  /** Optional editable title (for Notes) */
  title?: string;
  onTitleChange?: (value: string) => void;
  titleEditable?: boolean;

  /** Metadata shown under the title */
  subtitle?: string;

  /** Save state driven by parent */
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;

  /** Close/deselect callback */
  onCancel?: () => void;

  placeholder?: string;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

type FormatType =
  | "h1" | "h2" | "h3"
  | "bold" | "italic" | "underline" | "strike" | "code"
  | "blockquote" | "checkbox" | "link";

/**
 * Applies a markdown formatting operation to a textarea.
 * Uses requestAnimationFrame to restore focus + selection after React
 * re-renders the controlled textarea with the new value.
 */
function applyFormatting(
  el: HTMLTextAreaElement,
  type: FormatType,
  onChange: (v: string) => void,
) {
  const { value } = el;
  const ss = el.selectionStart ?? 0;
  const se = el.selectionEnd ?? 0;

  // ── Line-prefix operations ─────────────────────────────────────────────────
  if (
    type === "h1" || type === "h2" || type === "h3" ||
    type === "blockquote" || type === "checkbox"
  ) {
    const lineStart = value.lastIndexOf("\n", ss - 1) + 1;
    const rawLineEnd = value.indexOf("\n", se);
    const lineEnd = rawLineEnd === -1 ? value.length : rawLineEnd;

    const selectedLines = value.slice(lineStart, lineEnd).split("\n");
    const prefix =
      type === "h1"         ? "# "     :
      type === "h2"         ? "## "    :
      type === "h3"         ? "### "   :
      type === "blockquote" ? "> "     :
      /* checkbox */          "- [ ] ";

    const processed = selectedLines.map((line) => {
      if (type === "checkbox" && /^[-*+] \[[ xX]\] /.test(line)) {
        return line.replace(/^[-*+] \[[ xX]\] /, "");
      }
      // Toggle off if already prefixed with exactly this prefix
      if (line.startsWith(prefix)) return line.slice(prefix.length);
      // Replace a different heading prefix
      if (type.startsWith("h")) {
        const existing = line.match(/^#{1,6} /);
        if (existing) return prefix + line.slice(existing[0].length);
      }
      return prefix + line;
    });

    const newBlock    = processed.join("\n");
    const newValue    = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    const delta       = newBlock.length - (lineEnd - lineStart);

    onChange(newValue);
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.focus();
      el.setSelectionRange(ss + delta, se + delta);
    });
    return;
  }

  // ── Inline wrap operations ─────────────────────────────────────────────────
  const WRAP: Record<string, [string, string, string]> = {
    bold:      ["**",   "**",    "bold text"],
    italic:    ["*",    "*",     "italic text"],
    underline: ["<u>",  "</u>",  "underlined text"],
    strike:    ["~~",   "~~",    "strikethrough"],
    code:      ["`",    "`",     "code"],
    link:      ["[",    "](url)", "link text"],
  };

  const [open, close, placeholder] = WRAP[type] ?? ["", "", ""];
  if (!open) return;

  const selected = value.slice(ss, se) || placeholder;
  const newValue = value.slice(0, ss) + open + selected + close + value.slice(se);
  const newSS    = ss + open.length;
  const newSE    = newSS + selected.length;

  onChange(newValue);
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    el.focus();
    el.setSelectionRange(newSS, newSE);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarkdownEditorWorkspace({
  content,
  onContentChange,
  title,
  onTitleChange,
  titleEditable = false,
  subtitle,
  dirty = false,
  saving = false,
  onSave,
  onCancel,
  placeholder = "Start writing…",
}: MarkdownEditorWorkspaceProps) {
  const [viewMode, setViewMode]       = useState<ViewMode>("raw");
  const [editingTitle, setEditingTitle] = useState(false);

  const titleInputRef  = useRef<HTMLInputElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Points to whichever textarea is "active" for formatting toolbar actions
  const activeEditorRef = useRef<ActiveEditor | null>(null);

  // Keep activeEditorRef in sync when switching to raw mode
  useEffect(() => {
    if (viewMode === "raw") {
      activeEditorRef.current = rawTextareaRef.current
        ? { el: rawTextareaRef.current, onChange: onContentChange }
        : null;
    } else {
      activeEditorRef.current = null;
    }
  }, [viewMode, onContentChange]);

  // Re-sync raw textarea ref into activeEditorRef when onContentChange identity changes
  const syncRawEditor = useCallback(() => {
    if (viewMode === "raw" && rawTextareaRef.current) {
      activeEditorRef.current = { el: rawTextareaRef.current, onChange: onContentChange };
    }
  }, [viewMode, onContentChange]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
  };

  const handleFormat = (type: FormatType) => {
    // Resolve the active editor: prefer explicit registration, fall back to raw textarea
    const editor =
      activeEditorRef.current ??
      (viewMode === "raw" && rawTextareaRef.current
        ? { el: rawTextareaRef.current, onChange: onContentChange }
        : null);
    if (!editor) return;
    applyFormatting(editor.el, type, editor.onChange);
  };

  const handlePreviewActiveEditorChange = (editor: ActiveEditor | null) => {
    activeEditorRef.current = editor;
  };

  // ── Toolbar buttons config ─────────────────────────────────────────────────
  const toolbarGroups: Array<Array<{
    type: FormatType;
    icon: React.ReactNode;
    label: string;
  }>> = [
    [
      { type: "h1",   icon: <Heading1 size={13} />,    label: "Heading 1 (# )" },
      { type: "h2",   icon: <Heading2 size={13} />,    label: "Heading 2 (## )" },
      { type: "h3",   icon: <Heading3 size={13} />,    label: "Heading 3 (### )" },
    ],
    [
      { type: "bold",      icon: <Bold size={13} />,        label: "Bold (**text**)" },
      { type: "italic",    icon: <Italic size={13} />,      label: "Italic (*text*)" },
      { type: "underline", icon: <Underline size={13} />,   label: "Underline (<u>text</u>)" },
      { type: "strike",    icon: <Strikethrough size={13} />, label: "Strikethrough (~~text~~)" },
    ],
    [
      { type: "code",      icon: <Code size={13} />,      label: "Inline code (`code`)" },
      { type: "blockquote",icon: <Quote size={13} />,     label: "Blockquote (> )" },
      { type: "checkbox",  icon: <ListTodo size={13} />,  label: "Task / Checkbox (- [ ] )" },
      { type: "link",      icon: <Link size={13} />,      label: "Link ([text](url))" },
    ],
  ];

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        {/* Left: title + subtitle */}
        <div className={styles.titleArea}>
          {titleEditable && editingTitle ? (
            <input
              ref={titleInputRef}
              className={styles.titleInput}
              value={title ?? ""}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={handleTitleKeyDown}
              aria-label="Edit note title"
            />
          ) : (
            <span
              className={`${styles.titleText} ${titleEditable ? styles.titleEditable : ""}`}
              onClick={() => titleEditable && setEditingTitle(true)}
              title={titleEditable ? "Click to rename" : undefined}
              role={titleEditable ? "button" : undefined}
              tabIndex={titleEditable ? 0 : undefined}
              onKeyDown={(e) => {
                if (titleEditable && (e.key === "Enter" || e.key === " "))
                  setEditingTitle(true);
              }}
            >
              {title || "Untitled"}
            </span>
          )}
          {subtitle && (
            <Text size="xs" c="var(--text-secondary)" className={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </div>

        {/* Right: controls */}
        <Group gap={6} wrap="nowrap" align="center">
          {dirty && (
            <Text size="xs" c="var(--warning)" className={styles.unsaved}>
              Unsaved
            </Text>
          )}

          {/* Raw / Markdown toggle */}
          <div className={styles.modeToggle} role="group" aria-label="View mode">
            <button
              className={`${styles.modeBtn} ${viewMode === "raw" ? styles.modeBtnActive : ""}`}
              onClick={() => setViewMode("raw")}
              aria-pressed={viewMode === "raw"}
              title="Raw editor"
            >
              <Code size={12} />
              <span>Raw</span>
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === "markdown" ? styles.modeBtnActive : ""}`}
              onClick={() => setViewMode("markdown")}
              aria-pressed={viewMode === "markdown"}
              title="Editable preview"
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>

          {onCancel && (
            <ActionIcon
              variant="subtle"
              onClick={onCancel}
              aria-label="Close editor"
              styles={{
                root: {
                  color: "var(--text-secondary)",
                  "&:hover": { color: "var(--text-primary)" },
                },
              }}
            >
              <X size={14} />
            </ActionIcon>
          )}

          {onSave && (
            <Button
              size="xs"
              leftSection={<Save size={12} />}
              onClick={onSave}
              disabled={saving || !dirty}
              aria-label="Save"
              styles={{
                root: {
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-primary)",
                  "&:hover:not(:disabled)": { backgroundColor: "var(--accent-hover)" },
                  "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
                },
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </Group>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        {toolbarGroups.map((group, gi) => (
          <div key={gi} className={styles.toolbarGroup}>
            {group.map(({ type, icon, label }) => (
              <Tooltip key={type} label={label} position="bottom" withArrow openDelay={600}>
                <button
                  className={styles.toolbarBtn}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat(type)}
                  aria-label={label}
                  type="button"
                >
                  {icon}
                </button>
              </Tooltip>
            ))}
          </div>
        ))}

        {viewMode === "markdown" && (
          <span className={styles.toolbarHint} aria-live="polite">
            Click a block to edit
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {viewMode === "raw" ? (
          <textarea
            ref={rawTextareaRef}
            className={styles.textarea}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onFocus={syncRawEditor}
            placeholder={placeholder}
            spellCheck={false}
            aria-label="Content editor"
            aria-multiline="true"
          />
        ) : (
          <MarkdownPreview
            content={content}
            className={styles.previewScroll}
            onContentChange={onContentChange}
            onActiveEditorChange={handlePreviewActiveEditorChange}
          />
        )}
      </div>
    </div>
  );
}
