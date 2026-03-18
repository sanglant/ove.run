import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Textarea, Select } from "@mantine/core";
import type { ContextUnit, ContextUnitType } from "@/types";
import { arbiterGenerateContextUnit, fmtErr } from "@/lib/tauri";
import { useNotificationStore } from "@/stores/notificationStore";
import classes from "./ArbiterContextInput.module.css";

const TYPE_OPTIONS = [
  { value: "persona", label: "Persona" },
  { value: "skill", label: "Skill" },
  { value: "knowledge", label: "Knowledge" },
  { value: "reference", label: "Reference" },
];

interface Props {
  projectPath: string;
  projectId: string | null;
  onGenerated: (unit: ContextUnit) => void;
}

export function ArbiterContextInput({ projectPath, projectId, onGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [unitType, setUnitType] = useState<ContextUnitType>("knowledge");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const generated = await arbiterGenerateContextUnit(projectPath, unitType, prompt.trim());
      // Set project_id based on scope (always project scope from generator)
      const withProject: ContextUnit = {
        ...generated,
        project_id: projectId,
        scope: "project",
      };
      setPrompt("");
      setOpen(false);
      onGenerated(withProject);
    } catch (err) {
      useNotificationStore.getState().showToast("error", "Failed to generate context unit", fmtErr(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={classes.root}>
      <button
        type="button"
        className={classes.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle Arbiter context generator"
      >
        <Sparkles size={12} className={classes.toggleIcon} />
        <span className={classes.toggleLabel}>Generate with Arbiter</span>
        {open ? <ChevronUp size={11} className={classes.toggleChevron} /> : <ChevronDown size={11} className={classes.toggleChevron} />}
      </button>

      {open && (
        <div className={classes.body}>
          <Select
            data={TYPE_OPTIONS}
            value={unitType}
            onChange={(v) => v && setUnitType(v as ContextUnitType)}
            size="xs"
            disabled={busy}
            styles={{
              input: {
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                fontSize: 12,
              },
              dropdown: {
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--border)",
              },
              option: { color: "var(--text-primary)" },
            }}
          />

          <Textarea
            placeholder="Describe the context unit to generate (e.g. 'A persona for a senior Rust engineer who values safety and zero-cost abstractions')…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            minRows={2}
            autosize
            disabled={busy}
            styles={{
              input: {
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                fontSize: 12,
                resize: "none",
              },
            }}
          />

          <div className={classes.actions}>
            {busy && <Loader2 size={13} className={classes.spinner} />}
            <button
              type="button"
              className={classes.submitBtn}
              onClick={() => void handleGenerate()}
              disabled={busy || !prompt.trim()}
            >
              {busy ? "Generating…" : "Generate & review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
