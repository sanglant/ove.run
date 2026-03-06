/**
 * MarkdownPreview — lightweight markdown → React element renderer.
 *
 * No innerHTML, no external deps.
 * Supports: H1–H6, bold, italic, bold+italic, strikethrough, underline (<u>),
 * inline code, fenced code blocks (with mermaid chart rendering), unordered /
 * ordered lists, task-list checkboxes (- [ ] / - [x]), blockquotes, hr.
 *
 * When onContentChange is provided the preview becomes editable: clicking any
 * block reveals an inline textarea containing that block's raw source; blurring
 * or pressing Ctrl+Enter commits the edit back to the full document.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { MermaidChart } from "./MermaidChart";
import styles from "./MarkdownPreview.module.css";

// ── Inline formatter ───────────────────────────────────────────────────────────

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Priority: code > bold+italic > underline > bold > italic > strikethrough
  const re =
    /(`[^`\n]+`|<u>[^<\n]+<\/u>|\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|_[^_\n]+_|\*[^*\n]+\*|~~[^~\n]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const k   = `${keyPrefix}-${idx++}`;

    if (raw[0] === "`") {
      parts.push(<code key={k} className={styles.inlineCode}>{raw.slice(1, -1)}</code>);
    } else if (raw.startsWith("<u>")) {
      parts.push(<u key={k}>{raw.slice(3, -4)}</u>);
    } else if (raw.startsWith("***")) {
      parts.push(<strong key={k}><em>{raw.slice(3, -3)}</em></strong>);
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      parts.push(<strong key={k}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("*") || raw.startsWith("_")) {
      parts.push(<em key={k}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith("~~")) {
      parts.push(<del key={k}>{raw.slice(2, -2)}</del>);
    } else {
      parts.push(raw);
    }
    last = m.index + raw.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return <React.Fragment>{parts}</React.Fragment>;
}

// ── Block entry (node + source-line range) ────────────────────────────────────

interface BlockEntry {
  node: React.ReactNode;
  lineStart: number; // inclusive
  lineEnd: number;   // exclusive — first line index AFTER this block
}

// ── Checkbox toggle helper ────────────────────────────────────────────────────

type CheckboxToggle = (absoluteLine: number, nowChecked: boolean) => void;

// ── Block parser ──────────────────────────────────────────────────────────────

function parseBlocks(
  markdown: string,
  onCheckboxToggle?: CheckboxToggle,
): BlockEntry[] {
  const lines   = markdown.split("\n");
  const entries: BlockEntry[] = [];
  let i   = 0;
  let key = 0;

  while (i < lines.length) {
    const line       = lines[i];
    const blockStart = i;

    // ── Fenced code block ─────────────────────────────────────────────────────
    if (line.trimStart().startsWith("```")) {
      const lang       = line.trimStart().slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      const codeText = codeLines.join("\n");
      const node = lang === "mermaid"
        ? <MermaidChart key={key++} code={codeText} />
        : (
          <pre key={key++} className={styles.codeBlock}>
            <code>{codeText}</code>
          </pre>
        );

      entries.push({ node, lineStart: blockStart, lineEnd: i });
      continue;
    }

    // ── Heading ───────────────────────────────────────────────────────────────
    const hm = line.match(/^(#{1,6}) (.+)/);
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag   = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const cls   = styles[`h${level}`];
      i++;
      entries.push({
        node: <Tag key={key++} className={cls}>{renderInline(hm[2], `h${key}`)}</Tag>,
        lineStart: blockStart,
        lineEnd: i,
      });
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      i++;
      entries.push({ node: <hr key={key++} className={styles.hr} />, lineStart: blockStart, lineEnd: i });
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      const bk = key++;
      entries.push({
        node: (
          <blockquote key={bk} className={styles.blockquote}>
            {quoteLines.map((l, j) => (
              <p key={j}>{renderInline(l, `bq${bk}-${j}`)}</p>
            ))}
          </blockquote>
        ),
        lineStart: blockStart,
        lineEnd: i,
      });
      continue;
    }

    // ── Unordered list (with checkbox support) ────────────────────────────────
    if (/^[-*+] /.test(line)) {
      const itemLines: { text: string; absLine: number }[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        itemLines.push({ text: lines[i].replace(/^[-*+] /, ""), absLine: i });
        i++;
      }

      const uk = key++;
      const isTaskList = itemLines.some(({ text }) => /^\[[ xX]\] /.test(text));

      const node = isTaskList ? (
        <ul key={uk} className={`${styles.ul} ${styles.taskList}`}>
          {itemLines.map(({ text, absLine }, j) => {
            const cbMatch = text.match(/^\[([ xX])\] (.*)/);
            if (!cbMatch) {
              return <li key={j} className={styles.taskItem}>{renderInline(text, `ul${uk}-${j}`)}</li>;
            }
            const checked   = cbMatch[1].toLowerCase() === "x";
            const labelText = cbMatch[2];
            return (
              <li key={j} className={styles.taskItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onCheckboxToggle?.(absLine, !checked)}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.checkbox}
                  aria-label={labelText}
                  readOnly={!onCheckboxToggle}
                />
                <span className={checked ? styles.checkboxLabelDone : undefined}>
                  {renderInline(labelText, `cb${uk}-${j}`)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul key={uk} className={styles.ul}>
          {itemLines.map(({ text }, j) => (
            <li key={j}>{renderInline(text, `ul${uk}-${j}`)}</li>
          ))}
        </ul>
      );

      entries.push({ node, lineStart: blockStart, lineEnd: i });
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      const ok = key++;
      entries.push({
        node: (
          <ol key={ok} className={styles.ol}>
            {items.map((item, j) => (
              <li key={j}>{renderInline(item, `ol${ok}-${j}`)}</li>
            ))}
          </ol>
        ),
        lineStart: blockStart,
        lineEnd: i,
      });
      continue;
    }

    // ── Empty line ────────────────────────────────────────────────────────────
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,6} /) &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].startsWith("> ") &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      const pk = key++;
      entries.push({
        node: (
          <p key={pk} className={styles.p}>
            {paraLines.flatMap((l, j) =>
              j === 0
                ? [renderInline(l, `p${pk}-${j}`)]
                : [<br key={`br-${j}`} />, renderInline(l, `p${pk}-${j}`)],
            )}
          </p>
        ),
        lineStart: blockStart,
        lineEnd: i,
      });
    }
  }

  return entries;
}

// ── EditableBlock ─────────────────────────────────────────────────────────────
//
// Renders its children when idle. On click, replaces them with a textarea
// containing the raw source lines for this block; on blur / Ctrl+Enter the
// edited text is merged back into the full document.

interface ActiveEditor {
  el: HTMLTextAreaElement;
  onChange: (v: string) => void;
}

interface EditableBlockProps {
  lineStart: number;
  lineEnd: number;
  fullContent: string;
  onContentChange: (v: string) => void;
  onActiveEditorChange: (editor: ActiveEditor | null) => void;
  children: React.ReactNode;
}

function EditableBlock({
  lineStart,
  lineEnd,
  fullContent,
  onContentChange,
  onActiveEditorChange,
  children,
}: EditableBlockProps) {
  const [isEditing, setIsEditing]   = useState(false);
  const [editText,  setEditText]    = useState("");
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea to fit its content
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing) {
      autoResize();
      textareaRef.current?.focus();
    }
  }, [isEditing, autoResize]);

  function openEditor() {
    const allLines = fullContent.split("\n");
    const rawText  = allLines.slice(lineStart, lineEnd).join("\n");
    setEditText(rawText);
    setIsEditing(true);
  }

  function commitEdit() {
    const allLines = fullContent.split("\n");
    const before   = allLines.slice(0, lineStart);
    const after    = allLines.slice(lineEnd);
    const edited   = editText.split("\n");
    onContentChange([...before, ...edited, ...after].join("\n"));
    setIsEditing(false);
    onActiveEditorChange(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setIsEditing(false);
      onActiveEditorChange(null);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitEdit();
    }
  }

  function handleFocus() {
    if (textareaRef.current) {
      onActiveEditorChange({ el: textareaRef.current, onChange: setEditText });
    }
  }

  if (isEditing) {
    return (
      <div className={styles.editingBlock}>
        <textarea
          ref={textareaRef}
          className={styles.blockTextarea}
          value={editText}
          onChange={(e) => { setEditText(e.target.value); autoResize(); }}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          spellCheck={false}
          aria-label="Edit block"
        />
        <span className={styles.editHint}>Ctrl+Enter to commit · Esc to cancel</span>
      </div>
    );
  }

  return (
    <div
      className={styles.editableBlock}
      onClick={openEditor}
      role="button"
      tabIndex={0}
      aria-label="Click to edit block"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditor(); } }}
    >
      {children}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  /** Provide to enable editable preview mode */
  onContentChange?: (v: string) => void;
  /** Called when the user focuses / blurs an inline block editor */
  onActiveEditorChange?: (editor: ActiveEditor | null) => void;
}

// Re-export the type for consumers (MarkdownEditorWorkspace uses it)
export type { ActiveEditor };

export function MarkdownPreview({
  content,
  className,
  onContentChange,
  onActiveEditorChange,
}: MarkdownPreviewProps) {
  const editable = !!onContentChange;

  const onCheckboxToggle: CheckboxToggle | undefined = onContentChange
    ? (absLine, nowChecked) => {
        const lines = content.split("\n");
        if (nowChecked) {
          lines[absLine] = lines[absLine].replace(/^([-*+] )\[ \] /, "$1[x] ");
        } else {
          lines[absLine] = lines[absLine].replace(/^([-*+] )\[[xX]\] /, "$1[ ] ");
        }
        onContentChange(lines.join("\n"));
      }
    : undefined;

  const blockEntries = parseBlocks(content, onCheckboxToggle);

  return (
    <div
      className={`${styles.root} ${className ?? ""} ${editable ? styles.editableRoot : ""}`}
      aria-label="Markdown preview"
    >
      {blockEntries.length > 0 ? (
        editable
          ? blockEntries.map((entry, idx) => (
              <EditableBlock
                key={`${entry.lineStart}-${idx}`}
                lineStart={entry.lineStart}
                lineEnd={entry.lineEnd}
                fullContent={content}
                onContentChange={onContentChange!}
                onActiveEditorChange={onActiveEditorChange ?? (() => {})}
              >
                {entry.node}
              </EditableBlock>
            ))
          : blockEntries.map((entry) => entry.node)
      ) : (
        <span className={styles.empty}>
          {editable ? "Click to start writing…" : "Nothing to preview."}
        </span>
      )}
    </div>
  );
}
