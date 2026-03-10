import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Group, Modal, Alert, Text } from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
import { useSessionStore } from "@/stores/sessionStore";
import { getStatusMeta } from "@/constants/agents";
import { AgentBadge } from "@/components/ui/AgentBadge";
import cn from "clsx";
import classes from "./TopBar.module.css";

export function TopBar() {
  const { sessions, activeSessionId, updateSessionYolo } =
    useSessionStore();
  const [showYoloWarning, setShowYoloWarning] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const statusMeta = activeSession
    ? getStatusMeta(activeSession.status)
    : null;

  const handleYoloToggle = () => {
    if (!activeSession) return;
    setShowYoloWarning(true);
  };

  const handleYoloConfirm = () => {
    if (!activeSession) return;
    updateSessionYolo(activeSession.id, !activeSession.yoloMode);
    setShowYoloWarning(false);
  };

  return (
    <>
      <header className={classes.header}>
        {/* Left: Session info */}
        <div className={classes.sessionInfo}>
          {activeSession ? (
            <>
              {/* Agent type badge */}
              <AgentBadge agentType={activeSession.agentType} variant="displayName" />

              {/* Session label */}
              <Text size="sm" fw={500} truncate="end" className={classes.sessionLabel}>
                {activeSession.label}
              </Text>

              {/* Status */}
              {statusMeta && (
                <Text size="xs" c={statusMeta.color}>
                  {statusMeta.label}
                </Text>
              )}
            </>
          ) : (
            <Text size="xs" c="var(--text-secondary)">
              No active session
            </Text>
          )}
        </div>

        {/* Right: YOLO toggle only */}
        <Group gap={4}>
          {activeSession && activeSession.agentType !== "terminal" && (
            <button
              onClick={handleYoloToggle}
              aria-pressed={activeSession.yoloMode}
              title={
                activeSession.yoloMode
                  ? "YOLO mode active — click to disable (will respawn)"
                  : "Enable YOLO mode (will respawn)"
              }
              className={cn(classes.yoloButton, activeSession.yoloMode && classes.yoloButtonActive)}
            >
              {activeSession.yoloMode && (
                <AlertTriangle size={10} className={classes.flexShrink0} />
              )}
              YOLO
            </button>
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
        overlayProps={MODAL_OVERLAY_PROPS}
        styles={{
          ...MODAL_STYLES,
          body: { ...MODAL_STYLES.body, padding: 20 },
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
                className={classes.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleYoloConfirm}
                className={cn(classes.confirmButton, activeSession.yoloMode ? classes.confirmButtonDisable : classes.confirmButtonEnable)}
              >
                {activeSession.yoloMode ? "Disable" : "Enable YOLO"}
              </button>
            </Group>
          </>
        )}
      </Modal>
    </>
  );
}
