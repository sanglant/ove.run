import { useState, useEffect } from "react";
import { TextInput, Select, Textarea, Text } from "@mantine/core";
import { v4 as uuidv4 } from "uuid";
import { AppModal } from "@/components/ui/AppModal";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import type { ContextUnit, ContextUnitType, ContextScope } from "@/types";
import classes from "./ContextPanel.module.css";

const TYPE_OPTIONS = [
  { value: "persona", label: "Persona" },
  { value: "skill", label: "Skill" },
  { value: "knowledge", label: "Knowledge" },
  { value: "reference", label: "Reference" },
];

const SCOPE_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "project", label: "Project" },
];

const labelStyles = {
  color: "var(--text-secondary)",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const inputStyles = {
  input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
  label: labelStyles,
};

const selectStyles = {
  ...inputStyles,
  dropdown: { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" },
  option: { color: "var(--text-primary)" },
};

interface ContextUnitEditorProps {
  opened: boolean;
  unit: ContextUnit | null;
  projectId: string | null;
  onSave: (unit: ContextUnit) => Promise<void>;
  onClose: () => void;
}

export function ContextUnitEditor({ opened, unit, projectId, onSave, onClose }: ContextUnitEditorProps) {
  const isEdit = unit !== null;

  const [name, setName] = useState("");
  const [type, setType] = useState<ContextUnitType>("knowledge");
  const [scope, setScope] = useState<ContextScope>("project");
  const [tagsRaw, setTagsRaw] = useState("");
  const [l0Summary, setL0Summary] = useState("");
  const [l1Overview, setL1Overview] = useState("");
  const [l2Content, setL2Content] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (unit) {
      setName(unit.name);
      setType(unit.type);
      setScope(unit.scope);
      const parsed: string[] = (() => {
        try { return JSON.parse(unit.tags_json) as string[]; } catch { return []; }
      })();
      setTagsRaw(parsed.join(", "));
      setL0Summary(unit.l0_summary ?? "");
      setL1Overview(unit.l1_overview ?? "");
      setL2Content(unit.l2_content ?? "");
    } else {
      setName("");
      setType("knowledge");
      setScope("project");
      setTagsRaw("");
      setL0Summary("");
      setL1Overview("");
      setL2Content("");
    }
  }, [opened, unit]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const now = new Date().toISOString();
      const saved: ContextUnit = {
        id: unit?.id ?? uuidv4(),
        project_id: scope === "project" ? (projectId ?? null) : null,
        name: name.trim(),
        type,
        scope,
        tags_json: JSON.stringify(tags),
        l0_summary: l0Summary.trim() || null,
        l1_overview: l1Overview.trim() || null,
        l2_content: l2Content.trim() || null,
        created_at: unit?.created_at ?? now,
        updated_at: now,
        is_bundled: unit?.is_bundled ?? false,
        bundled_slug: unit?.bundled_slug ?? null,
      };
      await onSave(saved);
      onClose();
    } catch (err) {
      console.error("Failed to save context unit:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit context entry" : "New context entry"}
      centered
      size="xl"
      styles={{
        body: { padding: 20, display: "flex", flexDirection: "column", gap: 14 },
      }}
    >
      {/* Identity fields */}
      <TextInput
        label="Name"
        placeholder="e.g. Senior engineer persona"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        styles={inputStyles}
      />

      <div className={classes.editorRow}>
        <Select
          label="Type"
          data={TYPE_OPTIONS}
          value={type}
          onChange={(v) => v && setType(v as ContextUnitType)}
          styles={selectStyles}
        />
        <Select
          label="Scope"
          data={SCOPE_OPTIONS}
          value={scope}
          onChange={(v) => v && setScope(v as ContextScope)}
          styles={selectStyles}
        />
      </div>

      <TextInput
        label="Tags (comma-separated)"
        placeholder="e.g. backend, typescript, review"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        styles={inputStyles}
      />

      {/* L2 — Full content (primary, user-authored) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Text fz={11} fw={500} tt="uppercase" lts="0.05em" c="var(--text-secondary)">
          Content (L2)
        </Text>
        <Text fz={10} c="var(--text-tertiary)" lh={1.5}>
          The full context content in markdown. This is the primary source — L0 summary and L1 overview will be auto-generated from this when you click the sparkle icon on the card.
        </Text>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-tertiary)",
            minHeight: 180,
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          <RichTextEditor
            content={l2Content}
            onContentChange={setL2Content}
            placeholder="Write or paste the full context content here…"
          />
        </div>
      </div>

      {/* L1 — Overview (auto-generated, editable) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Textarea
          label="Overview (L1)"
          placeholder="Structured overview — auto-generated from content, or write your own"
          value={l1Overview}
          onChange={(e) => setL1Overview(e.target.value)}
          minRows={2}
          autosize
          styles={inputStyles}
        />
        <Text fz={10} c="var(--text-tertiary)" lh={1.4}>
          A mid-length overview covering key points. Auto-generated when you use "Generate summary" on the card, or you can write it manually.
        </Text>
      </div>

      {/* L0 — Summary (auto-generated, editable) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <TextInput
          label="Summary (L0)"
          placeholder="One-line summary — auto-generated from content"
          value={l0Summary}
          onChange={(e) => setL0Summary(e.target.value)}
          styles={inputStyles}
        />
        <Text fz={10} c="var(--text-tertiary)" lh={1.4}>
          A single sentence summary. Auto-generated from your L2 content when you click the sparkle icon on the card.
        </Text>
      </div>

      <div className={classes.editorActions}>
        <button
          type="button"
          className={classes.secondaryButton}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        {isEdit && unit?.scope === "global" && (
          <button
            type="button"
            className={classes.secondaryButton}
            onClick={() => {
              if (!unit) return;
              setName(unit.name);
              setType(unit.type);
              setScope(unit.scope);
              const parsed: string[] = (() => {
                try { return JSON.parse(unit.tags_json) as string[]; } catch { return []; }
              })();
              setTagsRaw(parsed.join(", "));
              setL0Summary(unit.l0_summary ?? "");
              setL1Overview(unit.l1_overview ?? "");
              setL2Content(unit.l2_content ?? "");
            }}
            disabled={saving}
          >
            Reset to default
          </button>
        )}
        <button
          type="button"
          className={classes.primaryButton}
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
        </button>
      </div>
    </AppModal>
  );
}
