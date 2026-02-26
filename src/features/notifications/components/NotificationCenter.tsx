import { Bell, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

export function NotificationCenter() {
  const { notifications, markRead, markAllRead, clearAll } =
    useNotificationStore();
  const { setActiveSession } = useSessionStore();
  const { setActivePanel } = useUiStore();

  const handleNotificationClick = (notificationId: string, sessionId: string) => {
    markRead(notificationId);
    setActiveSession(sessionId);
    setActivePanel("terminal");
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Notifications
          </span>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] text-[10px] font-bold">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={markAllRead}
            aria-label="Mark all as read"
            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded hover:bg-[var(--bg-tertiary)]"
          >
            <CheckCheck size={12} />
            All read
          </button>
          <button
            onClick={clearAll}
            aria-label="Clear all notifications"
            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors rounded hover:bg-[var(--bg-tertiary)]"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
            <Bell size={40} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm text-[var(--text-primary)]">No notifications</p>
              <p className="text-xs mt-1">
                Agent events will appear here
              </p>
            </div>
          </div>
        ) : (
          <ul role="list">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={[
                  "group relative cursor-pointer transition-colors",
                  !notification.read
                    ? "border-l-2 border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-l-2 border-transparent",
                ].join(" ")}
                onClick={() =>
                  handleNotificationClick(notification.id, notification.sessionId)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNotificationClick(notification.id, notification.sessionId);
                  }
                }}
                aria-label={`Notification: ${notification.title}`}
              >
                <div className="px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className={[
                          "text-sm font-medium truncate",
                          !notification.read
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)]",
                        ].join(" ")}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {formatTime(notification.timestamp)}
                      </span>
                      <ExternalLink
                        size={10}
                        className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-b border-[var(--border)] mx-4" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
