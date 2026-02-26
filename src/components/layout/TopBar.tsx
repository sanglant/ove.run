import { useState } from "react";
import { X, Plus, AlertTriangle } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { killPty } from "@/lib/tauri";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  starting: { label: "Starting", color: "text-[var(--warning)]" },
  idle: { label: "Idle", color: "text-[var(--text-secondary)]" },
  working: { label: "Working", color: "text-[var(--accent)]" },
  needs_input: { label: "Needs Input", color: "text-[var(--warning)]" },
  finished: { label: "Finished", color: "text-[var(--success)]" },
  error: { label: "Error", color: "text-[var(--danger)]" },
};

export function TopBar() {
  const { sessions, activeSessionId, removeSession, updateSessionYolo } =
    useSessionStore();
  const { activeProjectId } = useProjectStore();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showYoloWarning, setShowYoloWarning] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const statusMeta = activeSession
    ? (STATUS_LABELS[activeSession.status] ?? { label: activeSession.status, color: "text-[var(--text-secondary)]" })
    : null;

  const handleKill = async () => {
    if (!activeSession) return;
    try {
      await killPty(activeSession.id);
    } catch {
      // ignore
    }
    removeSession(activeSession.id);
  };

  const handleYoloToggle = () => {
    if (!activeSession) return;
    if (!activeSession.yoloMode) {
      // Enabling YOLO — show warning
      setShowYoloWarning(true);
    } else {
      // Disabling — warn about respawn
      setShowYoloWarning(true);
    }
  };

  const handleYoloConfirm = () => {
    if (!activeSession) return;
    updateSessionYolo(activeSession.id, !activeSession.yoloMode);
    setShowYoloWarning(false);
  };

  return (
    <>
      <header className="flex items-center justify-between h-9 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
        {/* Left: Session info */}
        <div className="flex items-center gap-2 min-w-0">
          {activeSession ? (
            <>
              {/* Agent type badge */}
              <span
                className={[
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                  activeSession.agentType === "claude"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "bg-[var(--success)]/15 text-[var(--success)]",
                ].join(" ")}
              >
                {activeSession.agentType === "claude" ? "Claude" : "Gemini"}
              </span>

              {/* Session label */}
              <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                {activeSession.label}
              </span>

              {/* Status */}
              {statusMeta && (
                <span className={`text-xs ${statusMeta.color}`}>
                  {statusMeta.label}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-[var(--text-secondary)]">
              No active session
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {activeSession && (
            <>
              {/* YOLO toggle */}
              <button
                onClick={handleYoloToggle}
                aria-pressed={activeSession.yoloMode}
                title={
                  activeSession.yoloMode
                    ? "YOLO mode active — click to disable (will respawn)"
                    : "Enable YOLO mode (will respawn)"
                }
                className={[
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors",
                  activeSession.yoloMode
                    ? "bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/40"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-transparent",
                ].join(" ")}
              >
                {activeSession.yoloMode && (
                  <AlertTriangle size={10} className="shrink-0" />
                )}
                YOLO
              </button>

              {/* Kill session */}
              <button
                onClick={handleKill}
                aria-label="Kill session"
                title="Kill session"
                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              >
                <X size={14} />
              </button>
            </>
          )}

          {/* New session */}
          {activeProjectId && (
            <button
              onClick={() => setShowNewDialog(true)}
              aria-label="New agent session"
              title="New session"
              className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </header>

      {/* YOLO confirmation */}
      {showYoloWarning && activeSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowYoloWarning(false);
          }}
        >
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg w-[360px] p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-[var(--warning)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeSession.yoloMode
                  ? "Disable YOLO Mode"
                  : "Enable YOLO Mode"}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-5">
              {activeSession.yoloMode
                ? "Disabling YOLO mode will respawn the agent process without the bypass flag."
                : "YOLO mode bypasses all confirmation prompts. The agent will be respawned with the danger flag. Proceed with caution."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowYoloWarning(false)}
                className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleYoloConfirm}
                className={[
                  "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                  activeSession.yoloMode
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]"
                    : "bg-[var(--danger)] text-white hover:opacity-90",
                ].join(" ")}
              >
                {activeSession.yoloMode ? "Disable" : "Enable YOLO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewDialog && (
        <NewAgentDialog
          projectId={activeProjectId ?? ""}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </>
  );
}
