import { useState, useEffect, useRef } from "react";
import type { KnowledgeEntry } from "@/types";
import { MarkdownEditorWorkspace } from "@/components/shared/MarkdownEditorWorkspace";

interface KnowledgeEditorProps {
  entry: KnowledgeEntry;
  content: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

export function KnowledgeEditor({
  entry,
  content: initialContent,
  onSave,
  onCancel,
}: KnowledgeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const previousInitialContentRef = useRef(initialContent);

  // Sync on external content updates only when the user has not diverged from the
  // previous saved value, so async save completions do not clobber newer typing.
  useEffect(() => {
    if (content === previousInitialContentRef.current) {
      setContent(initialContent);
    }
    previousInitialContentRef.current = initialContent;
  }, [content, initialContent]);

  const dirty = content !== initialContent;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarkdownEditorWorkspace
      content={content}
      onContentChange={setContent}
      title={entry.name}
      subtitle={entry.content_type.replace(/_/g, " ")}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      onCancel={onCancel}
      placeholder="Enter content here…"
    />
  );
}
