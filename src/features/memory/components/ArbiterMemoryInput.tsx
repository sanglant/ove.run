import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Textarea } from "@mantine/core";
import type { Memory } from "@/types";
import { arbiterGenerateMemory, arbiterCleanMemories, fmtErr } from "@/lib/tauri";
import { useNotificationStore } from "@/stores/notificationStore";
import classes from "./ArbiterMemoryInput.module.css";

interface Props {
  projectId: string;
  projectPath: string;
  memories: Memory[];
  onGenerated: () => void;
  onCleanSuggested: (ids: string[]) => void;
}

export function ArbiterMemoryInput({ projectId, projectPath, memories, onGenerated, onCleanSuggested }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"generate" | "clean">("generate");
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      await arbiterGenerateMemory(projectId, projectPath, prompt.trim());
      setPrompt("");
      onGenerated();
      useNotificationStore.getState().showToast("success", "Memories added", "Arbiter added new memories from your description.");
    } catch (err) {
      useNotificationStore.getState().showToast("error", "Failed to generate memories", fmtErr(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClean = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ids = await arbiterCleanMemories(projectId, projectPath, prompt.trim());
      if (ids.length === 0) {
        useNotificationStore.getState().showToast("success", "No noise found", "All memories look good.");
      } else {
        onCleanSuggested(ids);
      }
      setPrompt("");
    } catch (err) {
      useNotificationStore.getState().showToast("error", "Failed to analyze memories", fmtErr(err));
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
        aria-label="Toggle Arbiter memory input"
      >
        <Sparkles size={12} className={classes.toggleIcon} />
        <span className={classes.toggleLabel}>Arbiter</span>
        {open ? <ChevronUp size={11} className={classes.toggleChevron} /> : <ChevronDown size={11} className={classes.toggleChevron} />}
      </button>

      {open && (
        <div className={classes.body}>
          <div className={classes.modeRow}>
            <button
              type="button"
              className={`${classes.modeBtn} ${mode === "generate" ? classes.modeBtnActive : ""}`}
              onClick={() => setMode("generate")}
            >
              Generate
            </button>
            <button
              type="button"
              className={`${classes.modeBtn} ${mode === "clean" ? classes.modeBtnActive : ""}`}
              onClick={() => setMode("clean")}
            >
              Clean noise
            </button>
          </div>

          <Textarea
            placeholder={
              mode === "generate"
                ? "Describe what to remember (e.g. 'We use Postgres for all storage due to concurrency requirements')…"
                : "Optional: describe what kind of noise to remove (e.g. 'Remove duplicates about database setup')…"
            }
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
            {mode === "generate" ? (
              <button
                type="button"
                className={classes.submitBtn}
                onClick={() => void handleGenerate()}
                disabled={busy || !prompt.trim()}
              >
                {busy ? "Generating…" : "Generate memories"}
              </button>
            ) : (
              <button
                type="button"
                className={classes.submitBtn}
                onClick={() => void handleClean()}
                disabled={busy || memories.length === 0}
              >
                {busy ? "Analyzing…" : `Analyze ${memories.length} ${memories.length === 1 ? "memory" : "memories"}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
