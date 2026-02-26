import { useState } from "react";
import { Save, X } from "lucide-react";
import type { KnowledgeEntry } from "@/types";
import { ActionIcon, Button, Group, Text, Textarea } from "@mantine/core";

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Editor header */}
      <Group
        justify="space-between"
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div>
          <Text size="sm" fw={500} c="var(--text-primary)">
            {entry.name}
          </Text>
          <Text size="xs" c="var(--text-secondary)">
            {entry.content_type.replace("_", " ")}
          </Text>
        </div>

        <Group gap="xs" align="center">
          {dirty && (
            <Text size="xs" c="var(--warning)">
              Unsaved changes
            </Text>
          )}

          <ActionIcon
            variant="subtle"
            onClick={onCancel}
            aria-label="Cancel editing"
            styles={{
              root: {
                color: "var(--text-secondary)",
                "&:hover": { color: "var(--text-primary)" },
              },
            }}
          >
            <X size={14} />
          </ActionIcon>

          <Button
            size="xs"
            leftSection={<Save size={12} />}
            onClick={handleSave}
            disabled={saving || !dirty}
            aria-label="Save knowledge entry"
            styles={{
              root: {
                backgroundColor: "var(--accent)",
                color: "var(--bg-primary)",
                "&:hover:not(:disabled)": { backgroundColor: "var(--accent-hover)" },
                "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
              },
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </Group>
      </Group>

      {/* Editor body */}
      <Textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter content here..."
        aria-label={`Content for ${entry.name}`}
        spellCheck={false}
        autosize
        style={{ flex: 1 }}
        styles={{
          root: { flex: 1, display: "flex", flexDirection: "column" },
          wrapper: { flex: 1 },
          input: {
            flex: 1,
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontFamily: "monospace",
            fontSize: "13px",
            padding: "16px",
            resize: "none",
            border: "none",
            borderRadius: 0,
            lineHeight: 1.6,
            height: "100%",
            "&::placeholder": { color: "var(--text-secondary)" },
            "&:focus": { outline: "none" },
          },
        }}
      />
    </div>
  );
}
