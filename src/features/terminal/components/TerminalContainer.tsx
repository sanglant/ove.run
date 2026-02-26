import { useState } from "react";
import { Terminal } from "lucide-react";
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
    <div className="flex flex-col w-full h-full">
      <TerminalTabs
        sessions={projectSessions}
        onNewSession={() => setShowNewDialog(true)}
      />

      <div className="flex-1 relative overflow-hidden bg-[var(--bg-primary)]">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-full gap-4 text-[var(--text-secondary)]">
            <Terminal size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="text-lg font-medium text-[var(--text-primary)]">
                No active sessions
              </p>
              <p className="text-sm mt-1">
                {activeProjectId
                  ? "Start a new agent session to begin"
                  : "Select a project from the sidebar to get started"}
              </p>
            </div>
            {activeProjectId && (
              <button
                onClick={() => setShowNewDialog(true)}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg-primary)] font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                New Agent Session
              </button>
            )}
          </div>
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
