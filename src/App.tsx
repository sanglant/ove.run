import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TerminalContainer } from "@/features/terminal/components/TerminalContainer";
import { GitPanel } from "@/features/git/components/GitPanel";
import { KnowledgePanel } from "@/features/knowledge/components/KnowledgePanel";
import { NotesPanel } from "@/features/notes/components/NotesPanel";
import { BugsPanel } from "@/features/bugs/components/BugsPanel";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { AgentFeedbackModal } from "@/features/guardian/components/AgentFeedbackModal";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useNotifications } from "@/hooks/useNotifications";

export default function App() {
  const { loadProjects } = useProjectStore();
  const { loadSettings } = useSettingsStore();
  const { activePanel, setActivePanel, sidebarCollapsed } = useUiStore();
  const { loadPersistedSessions } = useSessionStore();

  // Initialize global notification listener
  useNotifications();

  useEffect(() => {
    loadProjects();
    loadSettings();
    loadPersistedSessions();
  }, [loadProjects, loadSettings, loadPersistedSessions]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      useSessionStore.getState().persistSessions();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
            width: 240,
          }}
        >
          <Sidebar />
        </div>
      )}

      {/* Main area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* TopBar: only shown for terminal panel */}
        {activePanel === "terminal" && <TopBar />}

        {/* Content */}
        <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {/* Terminal is always mounted but hidden when not active */}
          <div
            style={{
              display: activePanel === "terminal" ? "flex" : "none",
              position: "absolute",
              inset: 0,
            }}
          >
            <TerminalContainer />
          </div>

          {/* Git panel */}
          {activePanel === "git" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <GitPanel />
            </div>
          )}

          {/* Knowledge panel */}
          {activePanel === "knowledge" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <KnowledgePanel />
            </div>
          )}

          {/* Notes panel */}
          {activePanel === "notes" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <NotesPanel />
            </div>
          )}

          {/* Bugs panel */}
          {activePanel === "bugs" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <BugsPanel />
            </div>
          )}

          {/* Notifications panel */}
          {activePanel === "notifications" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <NotificationCenter />
            </div>
          )}
        </main>

        {/* Status bar */}
        <StatusBar />
      </div>

      {/* Settings modal — rendered as overlay */}
      {activePanel === "settings" && (
        <SettingsModal onClose={() => setActivePanel("terminal")} />
      )}

      {/* Agent feedback modal — always rendered, visibility driven by store queue */}
      <AgentFeedbackModal />
    </div>
  );
}
