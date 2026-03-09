import { useState, useEffect, useRef } from "react";
import type { KnowledgeEntry } from "@/types";
import { MarkdownEditorWorkspace } from "@/components/shared/MarkdownEditorWorkspace";

interface KnowledgeEditorProps {
  entry: KnowledgeEntry;
  content: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

function formatKnowledgeType(type: KnowledgeEntry["content_type"]): string {
  switch (type) {
    case "system_prompt":
      return "System prompt";
    case "context_file":
      return "Context file";
    case "notes":
      return "Knowledge note";
    default:
      return type;
  }
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
      eyebrow="Knowledge base"
      subtitle={formatKnowledgeType(entry.content_type)}
      updatedAt={entry.updated_at}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      onCancel={onCancel}
      placeholder="Build the markdown document here…"
    />
  );
}
