import { useEffect, useMemo, useRef } from "react";
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
import { AgentFeedbackToast } from "@/features/arbiter/components/AgentFeedbackToast";
import toastClasses from "@/features/arbiter/components/AgentFeedbackToast.module.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useAgentFeedbackStore } from "@/stores/agentFeedbackStore";
import { collectPanes } from "@/lib/layout";
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
  const { loadPersistedSessions, globalLayout } = useSessionStore();
  const feedbackQueue = useAgentFeedbackStore((s) => s.queue);
  const dismissFeedbackById = useAgentFeedbackStore((s) => s.dismissById);

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
    // loadProjects must complete before loadPersistedSessions so that
    // activeProjectId is set when resumed sessions are added — otherwise
    // tabs appear empty until the user manually switches projects.
    loadProjects().then(() => loadPersistedSessions());
    loadSettings();
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

  // Feedback items whose sessions are not visible in the terminal layout
  // (either terminal panel is inactive, or session isn't in the current layout)
  const visibleSessionIds = useMemo(() => {
    if (!globalLayout) return new Set<string>();
    const panes = collectPanes(globalLayout.root);
    return new Set(panes.map((p) => p.sessionId).filter(Boolean) as string[]);
  }, [globalLayout]);

  const floatingFeedback = useMemo(
    () =>
      feedbackQueue.filter(
        (item) => activePanel !== "terminal" || !visibleSessionIds.has(item.sessionId),
      ),
    [feedbackQueue, activePanel, visibleSessionIds],
  );

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
            <ErrorBoundary label="Terminal">
              <TerminalContainer />
            </ErrorBoundary>
          </div>

          {/* Git panel */}
          {activePanel === "git" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Git">
                <GitPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Context panel */}
          {activePanel === "context" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Context">
                <ContextPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Notes panel */}
          {activePanel === "notes" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Notes">
                <NotesPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Bugs panel */}
          {activePanel === "bugs" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Bugs">
                <BugsPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Memory panel */}
          {activePanel === "memory" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Memory">
                <MemoryPanel />
              </ErrorBoundary>
            </div>
          )}

          {/* Notifications panel */}
          {activePanel === "notifications" && (
            <div className={classes.panelContainer}>
              <ErrorBoundary label="Notifications">
                <NotificationCenter />
              </ErrorBoundary>
            </div>
          )}

          {/* Stats panel — always mounted to preserve state across panel switches */}
          <div
            className={cn(classes.panelContainer, activePanel !== "stats" && classes.terminalContainerHidden)}
          >
            <ErrorBoundary label="Stats">
              <StatsPanel />
            </ErrorBoundary>
          </div>
        </main>

        {/* Status bar */}
        <StatusBar />
      </div>

      {/* Settings modal — rendered as overlay */}
      {activePanel === "settings" && (
        <SettingsModal onClose={() => setActivePanel("terminal")} />
      )}

      {/* Agent feedback toasts for sessions not visible in the terminal layout */}
      {floatingFeedback.length > 0 && (
        <div className={toastClasses.fixedAnchor}>
          {floatingFeedback.map((item) => (
            <AgentFeedbackToast
              key={item.id}
              item={item}
              onDismiss={() => dismissFeedbackById(item.id)}
              showFocusButton
            />
          ))}
        </div>
      )}

      {/* Toast notifications — rendered as a fixed overlay */}
      <ToastContainer />
    </div>
  );
}
