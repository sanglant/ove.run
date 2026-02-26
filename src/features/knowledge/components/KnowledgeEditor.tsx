import { useState } from "react";
import { Save, X } from "lucide-react";
import type { KnowledgeEntry } from "@/types";

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
  const [dirty, setDirty] = useState(false);

  const handleChange = (value: string) => {
    setContent(value);
    setDirty(value !== initialContent);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] shrink-0">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {entry.name}
          </h3>
          <span className="text-xs text-[var(--text-secondary)]">
            {entry.content_type.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-[var(--warning)]">Unsaved changes</span>
          )}
          <button
            onClick={onCancel}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
            aria-label="Cancel editing"
          >
            <X size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Save knowledge entry"
          >
            <Save size={12} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm p-4 resize-none focus:outline-none border-none leading-relaxed"
        placeholder="Enter content here..."
        aria-label={`Content for ${entry.name}`}
        spellCheck={false}
      />
    </div>
  );
}
