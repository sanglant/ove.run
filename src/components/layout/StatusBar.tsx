import { Bell } from "lucide-react";
import { Group, Text } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";
import type { AgentStatus } from "@/types";

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
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 24,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
        fontSize: 10,
      }}
    >
      {/* Left: Session summary */}
      <Group gap={12} style={{ color: "var(--text-secondary)" }}>
        {totalSessions === 0 ? (
          <Text span size="xs" style={{ fontSize: 10 }}>No sessions</Text>
        ) : (
          <>
            <Text span size="xs" style={{ fontSize: 10 }}>
              {totalSessions} session{totalSessions !== 1 ? "s" : ""}
            </Text>
            {STATUS_ORDER.filter((s) => statusCounts[s]).map((status) => (
              <Text
                key={status}
                span
                size="xs"
                style={{ fontSize: 10, color: STATUS_COLORS[status] }}
              >
                {statusCounts[status]} {status.replace("_", " ")}
              </Text>
            ))}
          </>
        )}
      </Group>

      {/* Center: Project path */}
      {activeProject && (
        <div
          style={{
            flex: 1,
            textAlign: "center",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          <Text span ff="monospace" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
            {activeProject.path}
          </Text>
        </div>
      )}

      {/* Right: Notification badge */}
      <button
        onClick={() => setActivePanel("notifications")}
        aria-label={`${unreadCount} unread notifications`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--text-secondary)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontSize: 10,
        }}
      >
        <Bell size={10} />
        {unreadCount > 0 && (
          <Text span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700 }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        )}
      </button>
    </footer>
  );
}
