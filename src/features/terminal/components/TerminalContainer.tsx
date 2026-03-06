import { useState } from "react";
import { Terminal } from "lucide-react";
import { Stack, Text, Button } from "@mantine/core";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalPanel } from "./TerminalPanel";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";

export function TerminalContainer() {
  const { sessions, activeSessionId } = useSessionStore();
  const { activeProjectId, projects } = useProjectStore();
  const [showNewDialog, setShowNewDialog] = useState(false);

  const projectSessions = sessions.filter((s) => s.projectId === activeProjectId);
  const projectPathMap = new Map(projects.map((p) => [p.id, p.path]));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <TerminalTabs
        sessions={projectSessions}
        allSessions={sessions}
        onNewSession={() => setShowNewDialog(true)}
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        {sessions.length === 0 ? (
          <Stack
            align="center"
            justify="center"
            gap="md"
            className="animate-fade-in"
            style={{
              width: "100%",
              height: "100%",
              color: "var(--text-secondary)",
            }}
          >
            <Terminal size={48} strokeWidth={1} />
            <div style={{ textAlign: "center" }}>
              <Text size="lg" fw={500} style={{ color: "var(--text-primary)" }}>
                No active sessions
              </Text>
              <Text size="sm" mt={4}>
                {activeProjectId
                  ? "Start a new agent session to begin"
                  : "Select a project from the sidebar to get started"}
              </Text>
            </div>
            {activeProjectId && (
              <Button
                onClick={() => setShowNewDialog(true)}
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-primary)",
                }}
              >
                New Agent Session
              </Button>
            )}
          </Stack>
        ) : (
          /* Render ALL sessions from all projects to preserve terminal state.
             Only the active session is visible; others are hidden via display:none. */
          sessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: session.id === activeSessionId ? "flex" : "none",
                position: "absolute",
                inset: 0,
              }}
            >
              <TerminalPanel
                session={session}
                isActive={session.id === activeSessionId}
                projectPath={projectPathMap.get(session.projectId) ?? ""}
              />
            </div>
          ))
        )}
      </div>

      {showNewDialog && (
        <NewAgentDialog
          projectId={activeProjectId ?? ""}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
