import { useState, useEffect } from "react";
import { Modal, TextInput, Select, Textarea } from "@mantine/core";
import { v4 as uuidv4 } from "uuid";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit context unit" : "New context unit"}
      centered
      size="md"
      overlayProps={MODAL_OVERLAY_PROPS}
      styles={{
        ...MODAL_STYLES,
        body: { ...MODAL_STYLES.body, padding: 20, display: "flex", flexDirection: "column", gap: 14 },
      }}
    >
      <TextInput
        label="Name"
        placeholder="e.g. Senior engineer persona"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        styles={{
          input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
          label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
        }}
      />

      <div className={classes.editorRow}>
        <Select
          label="Type"
          data={TYPE_OPTIONS}
          value={type}
          onChange={(v) => v && setType(v as ContextUnitType)}
          styles={{
            input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
            label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
            dropdown: { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" },
            option: { color: "var(--text-primary)" },
          }}
        />
        <Select
          label="Scope"
          data={SCOPE_OPTIONS}
          value={scope}
          onChange={(v) => v && setScope(v as ContextScope)}
          styles={{
            input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
            label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
            dropdown: { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" },
            option: { color: "var(--text-primary)" },
          }}
        />
      </div>

      <TextInput
        label="Tags (comma-separated)"
        placeholder="e.g. backend, typescript, review"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        styles={{
          input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
          label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
        }}
      />

      <Textarea
        label="Full content (L2)"
        placeholder="Paste or write the full context content here…"
        value={l2Content}
        onChange={(e) => setL2Content(e.target.value)}
        minRows={5}
        autosize
        styles={{
          input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 },
          label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
        }}
      />

      <TextInput
        label="Summary (L0 — optional, auto-generated)"
        placeholder="One-line summary"
        value={l0Summary}
        onChange={(e) => setL0Summary(e.target.value)}
        styles={{
          input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
          label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
        }}
      />

      <Textarea
        label="Overview (L1 — optional, auto-generated)"
        placeholder="Short overview paragraph"
        value={l1Overview}
        onChange={(e) => setL1Overview(e.target.value)}
        minRows={2}
        autosize
        styles={{
          input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" },
          label: { color: "var(--text-secondary)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
        }}
      />

      <div className={classes.editorActions}>
        <button
          type="button"
          className={classes.secondaryButton}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={classes.primaryButton}
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
        </button>
      </div>
    </Modal>
  );
}
