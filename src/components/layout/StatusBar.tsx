import { Bell } from "lucide-react";
import { Group, Text } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";
import type { AgentStatus } from "@/types";
import classes from "./StatusBar.module.css";

const STATUS_ORDER: AgentStatus[] = [
  "working",
  "needs_input",
  "starting",
  "idle",
  "error",
  "finished",
];

const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "var(--accent)",
  needs_input: "var(--warning)",
  starting: "var(--warning)",
  idle: "var(--text-secondary)",
  error: "var(--danger)",
  finished: "var(--success)",
};

export function StatusBar() {
  const { sessions } = useSessionStore();
  const { projects, activeProjectId } = useProjectStore();
  const { unreadCount } = useNotificationStore();
  const { setActivePanel } = useUiStore();

  const activeProject = projects.find((p) => p.id === activeProjectId);

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
              <Text key={status} span fz={10} c={STATUS_COLORS[status]}>
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

      {/* Right: Notification badge */}
      <button
        onClick={() => setActivePanel("notifications")}
        aria-label={`${unreadCount} unread notifications`}
        className={classes.notificationButton}
      >
        <Bell size={10} />
        {unreadCount > 0 && (
          <Text span fz={10} c="var(--danger)" fw={700}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        )}
      </button>
    </footer>
  );
}
