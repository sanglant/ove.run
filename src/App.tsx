import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TerminalContainer } from "@/features/terminal/components/TerminalContainer";
import { GitPanel } from "@/features/git/components/GitPanel";
import { KnowledgePanel } from "@/features/knowledge/components/KnowledgePanel";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotifications } from "@/hooks/useNotifications";

export default function App() {
  const { loadProjects } = useProjectStore();
  const { loadSettings } = useSettingsStore();
  const { activePanel, setActivePanel, sidebarCollapsed } = useUiStore();

  // Initialize global notification listener
  useNotifications();

  useEffect(() => {
    loadProjects();
    loadSettings();
  }, [loadProjects, loadSettings]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 240 }}
        >
          <Sidebar />
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* TopBar: only shown for terminal panel */}
        {activePanel === "terminal" && <TopBar />}

        {/* Content */}
        <main className="flex-1 overflow-hidden relative">
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
            <div className="absolute inset-0 overflow-hidden">
              <GitPanel />
            </div>
          )}

          {/* Knowledge panel */}
          {activePanel === "knowledge" && (
            <div className="absolute inset-0 overflow-hidden">
              <KnowledgePanel />
            </div>
          )}

          {/* Notifications panel */}
          {activePanel === "notifications" && (
            <div className="absolute inset-0 overflow-hidden">
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
    </div>
  );
}
