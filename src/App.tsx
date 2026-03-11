import { useEffect, useRef } from "react";
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
import { useTour } from "@/hooks/useTour";
import { useTourStore } from "@/stores/tourStore";
import cn from "clsx";
import classes from "./App.module.css";

export default function App() {
  const { loadProjects } = useProjectStore();
  const { loadSettings } = useSettingsStore();
  const { activePanel, setActivePanel, sidebarCollapsed } = useUiStore();
  const { loadPersistedSessions } = useSessionStore();

  // Initialize global notification listener
  useNotifications();

  const { startHomeTour } = useTour();
  const { hasSeenHomeTour, setHomeTourSeen } = useTourStore();

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

  const hasSeenHomeTourRef = useRef(hasSeenHomeTour);
  useEffect(() => {
    if (hasSeenHomeTourRef.current) return;

    const timeout = setTimeout(() => {
      startHomeTour(setHomeTourSeen);
    }, 800);

    return () => clearTimeout(timeout);
  }, [startHomeTour, setHomeTourSeen]);

  return (
    <div className={classes.root}>
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div className={classes.sidebarWrapper}>
          <Sidebar />
        </div>
      )}

      {/* Main area */}
      <div className={classes.mainArea}>
        {/* TopBar: only shown for terminal panel */}
        {activePanel === "terminal" && <TopBar />}

        {/* Content */}
        <main className={classes.content}>
          {/* Terminal is always mounted but hidden when not active */}
          <div
            className={cn(classes.terminalContainer, activePanel !== "terminal" && classes.terminalContainerHidden)}
          >
            <TerminalContainer />
          </div>

          {/* Git panel */}
          {activePanel === "git" && (
            <div className={classes.panelContainer}>
              <GitPanel />
            </div>
          )}

          {/* Knowledge panel */}
          {activePanel === "knowledge" && (
            <div className={classes.panelContainer}>
              <KnowledgePanel />
            </div>
          )}

          {/* Notes panel */}
          {activePanel === "notes" && (
            <div className={classes.panelContainer}>
              <NotesPanel />
            </div>
          )}

          {/* Bugs panel */}
          {activePanel === "bugs" && (
            <div className={classes.panelContainer}>
              <BugsPanel />
            </div>
          )}

          {/* Notifications panel */}
          {activePanel === "notifications" && (
            <div className={classes.panelContainer}>
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
