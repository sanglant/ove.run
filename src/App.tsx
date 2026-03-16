import { useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TerminalContainer } from "@/features/terminal/components/TerminalContainer";
import { GitPanel } from "@/features/git/components/GitPanel";
import { ContextPanel } from "@/features/context/components/ContextPanel";
import { NotesPanel } from "@/features/notes/components/NotesPanel";
import { BugsPanel } from "@/features/bugs/components/BugsPanel";
import { MemoryPanel } from "@/features/memory/components/MemoryPanel";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { StatsPanel } from "@/features/stats/components/StatsPanel";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { AgentFeedbackModal } from "@/features/arbiter/components/AgentFeedbackModal";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useNotifications } from "@/hooks/useNotifications";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";
import { useTour } from "@/hooks/useTour";
import { useTourStore } from "@/stores/tourStore";
import { initLoopListener } from "@/stores/loopStore";
import cn from "clsx";
import classes from "./App.module.css";

export default function App() {
  const { loadProjects } = useProjectStore();
  const { loadSettings, loadSandboxCapabilities } = useSettingsStore();
  const { activePanel, setActivePanel, sidebarCollapsed } = useUiStore();
  const { loadPersistedSessions } = useSessionStore();

  // Initialize global notification listener
  useNotifications();
  useUpdateChecker();

  useEffect(() => {
    const cleanup = initLoopListener();
    return cleanup;
  }, []);

  const { startHomeTour } = useTour();
  const { hasSeenHomeTour, setHomeTourSeen } = useTourStore();

  useEffect(() => {
    loadProjects();
    loadSettings();
    loadPersistedSessions();
    loadSandboxCapabilities();
  }, [loadProjects, loadSettings, loadPersistedSessions, loadSandboxCapabilities]);

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

          {/* Context panel */}
          {activePanel === "context" && (
            <div className={classes.panelContainer}>
              <ContextPanel />
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

          {/* Memory panel */}
          {activePanel === "memory" && (
            <div className={classes.panelContainer}>
              <MemoryPanel />
            </div>
          )}

          {/* Notifications panel */}
          {activePanel === "notifications" && (
            <div className={classes.panelContainer}>
              <NotificationCenter />
            </div>
          )}

          {/* Stats panel — always mounted to preserve state across panel switches */}
          <div
            className={cn(classes.panelContainer, activePanel !== "stats" && classes.terminalContainerHidden)}
          >
            <StatsPanel />
          </div>
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

      {/* Toast notifications — rendered as a fixed overlay */}
      <ToastContainer />
    </div>
  );
}
