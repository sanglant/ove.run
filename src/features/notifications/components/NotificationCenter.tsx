import { Bell, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { writePty } from "@/lib/tauri";
import { Badge, Button, Text, Divider, Group } from "@mantine/core";
import type { NotificationAction } from "@/types";

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

  const handleAction = (
    e: React.MouseEvent,
    notificationId: string,
    action: NotificationAction,
  ) => {
    e.stopPropagation();
    if (action.action === "approve_override") {
      // Send Enter (\r) to confirm the pre-selected "Allow" in Claude Code's TUI
      writePty(action.sessionId, Array.from(new TextEncoder().encode("\r"))).catch(() => {});
      markRead(notificationId);
    } else if (action.action === "view_session" || action.action === "view_guardian") {
      setActiveSession(action.sessionId);
      setActivePanel("terminal");
    }
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <Group gap={8} wrap="nowrap">
          <Bell size={14} color="var(--accent)" />
          <Text
            size="sm"
            style={{ fontWeight: 500, color: "var(--text-primary)" }}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Badge
              size="xs"
              styles={{
                root: {
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-primary)",
                  fontWeight: 700,
                  fontSize: "10px",
                  padding: "0 6px",
                  height: "18px",
                },
              }}
            >
              {unreadCount}
            </Badge>
          )}
        </Group>
        <Group gap={4} wrap="nowrap">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<CheckCheck size={12} />}
            onClick={markAllRead}
            aria-label="Mark all as read"
            styles={{
              root: {
                color: "var(--text-secondary)",
                fontSize: "12px",
                "&:hover": {
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-tertiary)",
                },
              },
            }}
          >
            All read
          </Button>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<Trash2 size={12} />}
            onClick={clearAll}
            aria-label="Clear all notifications"
            styles={{
              root: {
                color: "var(--text-secondary)",
                fontSize: "12px",
                "&:hover": {
                  color: "var(--danger)",
                  backgroundColor: "var(--bg-tertiary)",
                },
              },
            }}
          >
            Clear
          </Button>
        </Group>
      </div>

      {/* Notification list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <Bell size={40} strokeWidth={1} />
            <div style={{ textAlign: "center" }}>
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
                No notifications
              </Text>
              <Text size="xs" c="dimmed" style={{ marginTop: "4px" }}>
                Agent events will appear here
              </Text>
            </div>
          </div>
        ) : (
          <ul role="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {notifications.map((notification) => (
              <li
                key={notification.id}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  borderLeft: notification.read
                    ? "2px solid transparent"
                    : "2px solid var(--accent)",
                  backgroundColor: notification.read
                    ? "transparent"
                    : "color-mix(in srgb, var(--accent) 5%, transparent)",
                }}
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
                <div
                  style={{ padding: "12px 16px", transition: "background-color 150ms" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        size="sm"
                        style={{
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: notification.read
                            ? "var(--text-secondary)"
                            : "var(--text-primary)",
                        }}
                      >
                        {notification.title}
                      </Text>
                      <Text
                        size="xs"
                        lineClamp={2}
                        style={{
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        {notification.body}
                      </Text>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      <Text size="xs" c="dimmed">
                        {formatTime(notification.timestamp)}
                      </Text>
                      <ExternalLink
                        size={10}
                        style={{
                          color: "var(--text-secondary)",
                          opacity: 0,
                          transition: "opacity 150ms",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "0")
                        }
                      />
                    </div>
                  </div>
                  {notification.actions && notification.actions.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginTop: "8px",
                      }}
                    >
                      {notification.actions.map((action) => (
                        <button
                          key={action.action + action.sessionId}
                          onClick={(e) => handleAction(e, notification.id, action)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "9999px",
                            fontSize: "11px",
                            fontWeight: 500,
                            border: "1px solid",
                            cursor: "pointer",
                            transition: "background-color 150ms, color 150ms",
                            backgroundColor:
                              action.action === "approve_override"
                                ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                                : "color-mix(in srgb, var(--accent) 10%, transparent)",
                            borderColor:
                              action.action === "approve_override"
                                ? "color-mix(in srgb, var(--warning) 40%, transparent)"
                                : "color-mix(in srgb, var(--accent) 30%, transparent)",
                            color:
                              action.action === "approve_override"
                                ? "var(--warning)"
                                : "var(--accent)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              action.action === "approve_override"
                                ? "color-mix(in srgb, var(--warning) 25%, transparent)"
                                : "color-mix(in srgb, var(--accent) 20%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              action.action === "approve_override"
                                ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                                : "color-mix(in srgb, var(--accent) 10%, transparent)";
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Divider
                  style={{ marginLeft: "16px", marginRight: "16px" }}
                  color="var(--border)"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
