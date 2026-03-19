import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import classes from "./MarkdownViewer.module.css";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

// Configure marked for safe, clean output
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      className={`${classes.markdown} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
