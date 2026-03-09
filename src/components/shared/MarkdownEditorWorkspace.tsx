import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Save,
  X,
  PenLine,
  Columns2,
  Code2,
} from "lucide-react";
import { useUiStore, type EditorLayoutMode } from "@/stores/uiStore";
import { RichTextEditor } from "./RichTextEditor";
import styles from "./MarkdownEditorWorkspace.module.css";

interface MarkdownEditorWorkspaceProps {
  content: string;
  onContentChange: (value: string) => void;
  title?: string;
  onTitleChange?: (value: string) => void;
  titleEditable?: boolean;
  subtitle?: string;
  eyebrow?: string;
  updatedAt?: string;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

function formatUpdatedAt(updatedAt?: string): string | null {
  if (!updatedAt) return null;

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;

  return `Updated ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

const layoutOptions: Array<{
  mode: EditorLayoutMode;
  icon: ReactNode;
  label: string;
  hint: string;
}> = [
  {
    mode: "write",
    icon: <PenLine size={13} />,
    label: "Write",
    hint: "Rich text editor with formatting menus",
  },
  {
    mode: "split",
    icon: <Columns2 size={13} />,
    label: "Split",
    hint: "Rich text and raw markdown side by side",
  },
  {
    mode: "raw",
    icon: <Code2 size={13} />,
    label: "Raw",
    hint: "Edit raw markdown source directly",
  },
];

export function MarkdownEditorWorkspace({
  content,
  onContentChange,
  title,
  onTitleChange,
  titleEditable = false,
  subtitle,
  eyebrow,
  updatedAt,
  dirty = false,
  saving = false,
  onSave,
  onCancel,
  placeholder = "Start writing…",
}: MarkdownEditorWorkspaceProps) {
  const { editorLayoutMode, setEditorLayoutMode } = useUiStore();
  const [editingTitle, setEditingTitle] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditingTitle(false);
    }
  };

  const metrics = useMemo(() => {
    const trimmed = content.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
    const lineCount = content ? content.split("\n").length : 0;
    const characterCount = content.length;
    const readingMinutes =
      wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 220)) : 0;

    return { wordCount, lineCount, characterCount, readingMinutes };
  }, [content]);

  const updatedLabel = formatUpdatedAt(updatedAt);
  const showWritePane =
    editorLayoutMode === "write" || editorLayoutMode === "split";
  const showRawPane =
    editorLayoutMode === "raw" || editorLayoutMode === "split";

  return (
    <section className={styles.root} aria-label="Markdown editor workspace">
      <div className={styles.headerActions}>
        {dirty && <span className={styles.unsaved}>Unsaved changes</span>}

        <div
          className={styles.modeToggle}
          role="group"
          aria-label="Editor layout mode"
        >
          {layoutOptions.map((option) => (
            <button
              key={option.mode}
              type="button"
              className={`${styles.modeButton} ${
                editorLayoutMode === option.mode ? styles.modeButtonActive : ""
              }`}
              aria-pressed={editorLayoutMode === option.mode}
              onClick={() => setEditorLayoutMode(option.mode)}
              title={option.hint}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {onCancel && (
          <button
            type="button"
            className={styles.chromeButton}
            onClick={onCancel}
            aria-label="Close editor"
            title="Close"
          >
            <X size={14} />
          </button>
        )}

        {onSave && (
          <button
            type="button"
            className={styles.saveButton}
            onClick={onSave}
            disabled={saving || !dirty}
            aria-label="Save document"
          >
            <Save size={13} />
            <span>{saving ? "Saving…" : "Save"}</span>
          </button>
        )}
      </div>

      <header className={styles.header}>
        <div className={styles.identityBlock}>
          {(eyebrow || subtitle) && (
            <div className={styles.metaRow}>
              {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
              {subtitle && (
                <span className={styles.subtitle}>{subtitle}</span>
              )}
            </div>
          )}

          {titleEditable && editingTitle ? (
            <input
              ref={titleInputRef}
              className={styles.titleInput}
              value={title ?? ""}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={handleTitleKeyDown}
              aria-label="Edit document title"
            />
          ) : (
            <span
              className={`${styles.titleText} ${titleEditable ? styles.titleEditable : ""}`}
              onClick={() => titleEditable && setEditingTitle(true)}
              role={titleEditable ? "button" : undefined}
              tabIndex={titleEditable ? 0 : undefined}
              title={titleEditable ? "Click to rename" : undefined}
              onKeyDown={(e) => {
                if (titleEditable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setEditingTitle(true);
                }
              }}
            >
              {title || "Untitled"}
            </span>
          )}

          <div className={styles.summaryRow}>
            {updatedLabel && (
              <span className={styles.summaryText}>{updatedLabel}</span>
            )}
            <span className={styles.summaryText}>
              {metrics.wordCount} {metrics.wordCount === 1 ? "word" : "words"}
            </span>
            <span className={styles.summaryText}>
              {metrics.lineCount} {metrics.lineCount === 1 ? "line" : "lines"}
            </span>
            <span className={styles.summaryText}>
              {metrics.characterCount}{" "}
              {metrics.characterCount === 1 ? "character" : "characters"}
            </span>
            <span className={styles.summaryText}>
              {metrics.readingMinutes === 0
                ? "Draft"
                : `${metrics.readingMinutes} min read`}
            </span>
          </div>
        </div>
      </header>

      <div
        className={`${styles.body} ${
          editorLayoutMode === "split" ? styles.bodySplit : styles.bodySingle
        }`}
      >
        {showWritePane && (
          <div className={styles.panel}>
            {editorLayoutMode === "split" && (
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>Write</span>
                <span className={styles.panelDescription}>
                  Select text to format
                </span>
              </div>
            )}
            <div className={styles.panelSurface}>
              <RichTextEditor
                content={content}
                onContentChange={onContentChange}
                className={styles.editorViewport}
                placeholder={placeholder}
                onSave={onSave}
              />
            </div>
          </div>
        )}

        {showRawPane && (
          <div className={styles.panel}>
            {editorLayoutMode === "split" && (
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>Raw</span>
                <span className={styles.panelDescription}>
                  Markdown source
                </span>
              </div>
            )}
            <div className={styles.panelSurface}>
              <textarea
                className={styles.textarea}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                aria-label="Raw markdown editor"
                aria-multiline="true"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
