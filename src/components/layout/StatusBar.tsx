import { Bell } from "lucide-react";
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
  working: "text-[var(--accent)]",
  needs_input: "text-[var(--warning)]",
  starting: "text-[var(--warning)]",
  idle: "text-[var(--text-secondary)]",
  error: "text-[var(--danger)]",
  finished: "text-[var(--success)]",
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
    <footer className="flex items-center justify-between h-6 px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] shrink-0 text-[10px]">
      {/* Left: Session summary */}
      <div className="flex items-center gap-3 text-[var(--text-secondary)]">
        {totalSessions === 0 ? (
          <span>No sessions</span>
        ) : (
          <>
            <span>{totalSessions} session{totalSessions !== 1 ? "s" : ""}</span>
            {STATUS_ORDER.filter((s) => statusCounts[s]).map((status) => (
              <span key={status} className={STATUS_COLORS[status]}>
                {statusCounts[status]} {status.replace("_", " ")}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Center: Project path */}
      {activeProject && (
        <div className="flex-1 text-center text-[var(--text-secondary)] truncate px-4">
          <span className="font-mono opacity-70">{activeProject.path}</span>
        </div>
      )}

      {/* Right: Notification badge */}
      <button
        onClick={() => setActivePanel("notifications")}
        aria-label={`${unreadCount} unread notifications`}
        className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Bell size={10} />
        {unreadCount > 0 && (
          <span className="text-[var(--danger)] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </footer>
  );
}
