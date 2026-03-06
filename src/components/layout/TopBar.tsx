import { useState } from "react";
import { X, Plus, AlertTriangle, Shield } from "lucide-react";
import { ActionIcon, Group, Modal, Alert, Text, Tooltip } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useGuardianStore } from "@/stores/guardianStore";
import { killPty } from "@/lib/tauri";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  starting: { label: "Starting", color: "var(--warning)" },
  idle: { label: "Idle", color: "var(--text-secondary)" },
  working: { label: "Working", color: "var(--accent)" },
  needs_input: { label: "Needs Input", color: "var(--warning)" },
  finished: { label: "Finished", color: "var(--success)" },
  error: { label: "Error", color: "var(--danger)" },
};

const AGENT_DISPLAY_NAMES: Record<string, string> = { claude: 'Claude', gemini: 'Gemini', copilot: 'Copilot', codex: 'Codex', terminal: 'Terminal' };

export function TopBar() {
  const { sessions, activeSessionId, removeSession, updateSessionYolo } =
    useSessionStore();
  const { activeProjectId } = useProjectStore();
  const guardianSessionIds = useGuardianStore((s) => s.guardianSessionIds);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showYoloWarning, setShowYoloWarning] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const statusMeta = activeSession
    ? (STATUS_LABELS[activeSession.status] ?? { label: activeSession.status, color: "var(--text-secondary)" })
    : null;
  const projectHasGuardian = activeProjectId ? !!guardianSessionIds[activeProjectId] : false;

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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 36,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {/* Left: Session info */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {activeSession ? (
            <>
              {/* Agent type badge */}
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  backgroundColor: `color-mix(in srgb, var(--${activeSession.agentType}) 15%, transparent)`,
                  color: `var(--${activeSession.agentType})`,
                }}
              >
                {AGENT_DISPLAY_NAMES[activeSession.agentType] || activeSession.agentType}
              </span>

              {/* Guardian badge — shown when active session is a guardian */}
              {activeSession.isGuardian && (
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: "color-mix(in srgb, var(--guardian) 20%, transparent)",
                    color: "var(--guardian)",
                    border: "1px solid color-mix(in srgb, var(--guardian) 35%, transparent)",
                  }}
                >
                  Guardian
                </span>
              )}

              {/* Session label */}
              <Text
                size="sm"
                fw={500}
                truncate="end"
                style={{
                  color: "var(--text-primary)",
                  maxWidth: 200,
                }}
              >
                {activeSession.label}
              </Text>

              {/* Shield indicator — shown when project has active guardian but session is not the guardian */}
              {projectHasGuardian && !activeSession.isGuardian && (
                <Tooltip label="Guardian active for this project" withArrow>
                  <Shield size={12} style={{ color: "var(--guardian)", flexShrink: 0 }} />
                </Tooltip>
              )}

              {/* Status */}
              {statusMeta && (
                <Text size="xs" style={{ color: statusMeta.color }}>
                  {statusMeta.label}
                </Text>
              )}
            </>
          ) : (
            <Text size="xs" style={{ color: "var(--text-secondary)" }}>
              No active session
            </Text>
          )}
        </div>

        {/* Right: Actions */}
        <Group gap={4}>
          {activeSession && (
            <>
              {/* YOLO toggle — hidden for guardian sessions */}
              {!activeSession.isGuardian && (
                <button
                  onClick={handleYoloToggle}
                  aria-pressed={activeSession.yoloMode}
                  title={
                    activeSession.yoloMode
                      ? "YOLO mode active — click to disable (will respawn)"
                      : "Enable YOLO mode (will respawn)"
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    transition: "color 150ms, background-color 150ms",
                    backgroundColor: activeSession.yoloMode
                      ? "color-mix(in srgb, var(--danger) 20%, transparent)"
                      : "transparent",
                    color: activeSession.yoloMode
                      ? "var(--danger)"
                      : "var(--text-secondary)",
                    border: activeSession.yoloMode
                      ? "1px solid color-mix(in srgb, var(--danger) 40%, transparent)"
                      : "1px solid transparent",
                    boxShadow: activeSession.yoloMode
                      ? "0 0 8px 0 color-mix(in srgb, var(--danger) 25%, transparent)"
                      : "none",
                  }}
                >
                  {activeSession.yoloMode && (
                    <AlertTriangle size={10} style={{ flexShrink: 0 }} />
                  )}
                  YOLO
                </button>
              )}

              {/* Kill session */}
              <Tooltip label="Kill session" withArrow>
                <ActionIcon
                  variant="subtle"
                  onClick={handleKill}
                  aria-label="Kill session"
                  size={28}
                  style={{ color: "var(--text-secondary)" }}
                  styles={{
                    root: {
                      "--ai-hover-color": "var(--danger)",
                      "--ai-hover-bg": "color-mix(in srgb, var(--danger) 10%, transparent)",
                    },
                  }}
                >
                  <X size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}

          {/* New session */}
          {activeProjectId && (
            <Tooltip label="New session" withArrow>
              <ActionIcon
                variant="subtle"
                onClick={() => setShowNewDialog(true)}
                aria-label="New agent session"
                size={28}
                style={{ color: "var(--text-secondary)" }}
                styles={{
                  root: {
                    "--ai-hover-color": "var(--accent)",
                    "--ai-hover-bg": "color-mix(in srgb, var(--accent) 10%, transparent)",
                  },
                }}
              >
                <Plus size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </header>

      {/* YOLO confirmation modal */}
      <Modal
        opened={showYoloWarning && !!activeSession}
        onClose={() => setShowYoloWarning(false)}
        title={activeSession?.yoloMode ? "Disable YOLO Mode" : "Enable YOLO Mode"}
        centered
        size="sm"
        overlayProps={{ blur: 3, backgroundOpacity: 0.6 }}
        styles={{
          header: { backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" },
          title: { color: "var(--text-primary)", fontSize: 14, fontWeight: 600 },
          body: { padding: 20, backgroundColor: "var(--bg-elevated)" },
          content: { backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" },
          close: { color: "var(--text-secondary)" },
        }}
      >
        {activeSession && (
          <>
            <Alert
              color={activeSession.yoloMode ? "yellow" : "red"}
              icon={<AlertTriangle size={16} />}
              mb="md"
              styles={{
                root: { backgroundColor: "transparent", border: "none", padding: 0 },
                message: { color: "var(--text-secondary)", fontSize: 12 },
                icon: { color: activeSession.yoloMode ? "var(--warning)" : "var(--danger)" },
              }}
            >
              {activeSession.yoloMode
                ? "Disabling YOLO mode will respawn the agent process without the bypass flag."
                : "YOLO mode bypasses all confirmation prompts. The agent will be respawned with the danger flag. Proceed with caution."}
            </Alert>

            <Group justify="flex-end" gap={8}>
              <button
                onClick={() => setShowYoloWarning(false)}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "color 150ms",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleYoloConfirm}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 150ms",
                  backgroundColor: activeSession.yoloMode
                    ? "var(--bg-tertiary)"
                    : "var(--danger)",
                  color: activeSession.yoloMode
                    ? "var(--text-primary)"
                    : "white",
                }}
              >
                {activeSession.yoloMode ? "Disable" : "Enable YOLO"}
              </button>
            </Group>
          </>
        )}
      </Modal>

      {showNewDialog && (
        <NewAgentDialog
          projectId={activeProjectId ?? ""}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </>
  );
}
