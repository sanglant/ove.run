import { Bell, CircleHelp } from "lucide-react";
import { Group, Text, ActionIcon } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";
import type { AgentStatus } from "@/types";
import { STATUS_META, STATUS_ORDER } from "@/constants/agents";
import { useTour } from "@/hooks/useTour";
import { panelTours } from "@/constants/tours";
import classes from "./StatusBar.module.css";

export function StatusBar() {
  const { sessions } = useSessionStore();
  const { projects, activeProjectId } = useProjectStore();
  const { unreadCount } = useNotificationStore();
  const { activePanel, setActivePanel } = useUiStore();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const { startPanelTour } = useTour();
  const hasTour = activePanel in panelTours;

  // Count sessions by status
  const statusCounts = sessions.reduce(
    (acc, session) => {
      acc[session.status] = (acc[session.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<AgentStatus, number>>,
  );

  const totalSessions = sessions.length;

  return (
    <footer className={classes.footer}>
      {/* Left: Session summary */}
      <Group gap={12} className={classes.sessionSummary}>
        {totalSessions === 0 ? (
          <Text span fz={10}>No sessions</Text>
        ) : (
          <>
            <Text span fz={10}>
              {totalSessions} session{totalSessions !== 1 ? "s" : ""}
            </Text>
            {STATUS_ORDER.filter((s) => statusCounts[s]).map((status) => (
              <Text key={status} span fz={10} c={STATUS_META[status].color}>
                {statusCounts[status]} {status.replace("_", " ")}
              </Text>
            ))}
          </>
        )}
      </Group>

      {/* Center: Project path */}
      {activeProject && (
        <div className={classes.projectPath}>
          <Text span ff="monospace" fz={10} c="var(--text-tertiary)">
            {activeProject.path}
          </Text>
        </div>
      )}

      {/* Right section */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {hasTour && (
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => startPanelTour(activePanel)}
            aria-label="Start help tour"
            title="Help tour"
            styles={{
              root: {
                color: "var(--text-secondary)",
              },
            }}
          >
            <CircleHelp size={12} />
          </ActionIcon>
        )}
        <button
          onClick={() => setActivePanel("notifications")}
          aria-label={`${unreadCount} unread notifications`}
          className={classes.notificationButton}
          data-tour="statusbar-notifications"
        >
          <Bell size={10} />
          {unreadCount > 0 && (
            <Text span fz={10} c="var(--danger)" fw={700}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          )}
        </button>
      </div>
    </footer>
  );
}
