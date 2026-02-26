import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { listAgentTypes } from "@/lib/tauri";
import type { AgentType, AgentDefinition, AgentSession } from "@/types";

interface NewAgentDialogProps {
  projectId: string;
  onClose: () => void;
}

export function NewAgentDialog({ projectId, onClose }: NewAgentDialogProps) {
  const [agentType, setAgentType] = useState<AgentType>("claude");
  const [yoloMode, setYoloMode] = useState(false);
  const [label, setLabel] = useState("");
  const [agentDefs, setAgentDefs] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const { addSession } = useSessionStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    listAgentTypes()
      .then(setAgentDefs)
      .catch(() => {
        // Use fallback definitions
        setAgentDefs([
          {
            agent_type: "claude",
            display_name: "Claude Code",
            command: "claude",
            default_args: [],
            yolo_flag: "--dangerously-skip-permissions",
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "C",
          },
          {
            agent_type: "gemini",
            display_name: "Gemini CLI",
            command: "gemini",
            default_args: [],
            yolo_flag: "--yolo",
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "G",
          },
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const agentSettings = settings.agents[agentType];
    if (agentSettings) {
      setYoloMode(agentSettings.default_yolo_mode);
    }
  }, [agentType, settings.agents]);

  const handleStart = () => {
    if (!projectId) return;
    setLoading(true);

    const sessionLabel =
      label.trim() ||
      `${agentType === "claude" ? "Claude" : "Gemini"} #${Date.now().toString(36).slice(-4)}`;

    const session: AgentSession = {
      id: uuidv4(),
      projectId,
      agentType,
      status: "starting",
      yoloMode,
      createdAt: new Date().toISOString(),
      label: sessionLabel,
    };

    addSession(session);
    setLoading(false);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const claudeDef = agentDefs.find((d) => d.agent_type === "claude");
  const geminiDef = agentDefs.find((d) => d.agent_type === "gemini");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-agent-title"
    >
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 id="new-agent-title" className="text-sm font-semibold text-[var(--text-primary)]">
            New Agent Session
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Agent type selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Agent Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAgentType("claude")}
                className={[
                  "flex items-center gap-3 p-3 rounded border transition-all text-left",
                  agentType === "claude"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                <span className="text-lg font-bold text-[var(--accent)]">C</span>
                <div>
                  <div className="text-sm font-medium">Claude</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {claudeDef?.display_name ?? "Claude Code"}
                  </div>
                </div>
              </button>
              <button
                onClick={() => setAgentType("gemini")}
                className={[
                  "flex items-center gap-3 p-3 rounded border transition-all text-left",
                  agentType === "gemini"
                    ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--success)]/50 hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                <span className="text-lg font-bold text-[var(--success)]">G</span>
                <div>
                  <div className="text-sm font-medium">Gemini</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {geminiDef?.display_name ?? "Gemini CLI"}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Label input */}
          <div>
            <label
              htmlFor="session-label"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider"
            >
              Label{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              id="session-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Feature branch, Bug fix..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStart();
              }}
            />
          </div>

          {/* YOLO mode toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                YOLO Mode
              </label>
              <button
                role="switch"
                aria-checked={yoloMode}
                onClick={() => setYoloMode((v) => !v)}
                className={[
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  yoloMode ? "bg-[var(--danger)]" : "bg-[var(--bg-tertiary)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                    yoloMode ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            </div>
            {yoloMode && (
              <div className="flex items-start gap-2 p-2.5 rounded bg-[var(--danger)]/10 border border-[var(--danger)]/30">
                <AlertTriangle size={14} className="text-[var(--danger)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--danger)]">
                  YOLO mode bypasses all confirmation prompts. The agent will
                  execute commands without asking for permission.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !projectId}
            className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Starting..." : "Start Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
