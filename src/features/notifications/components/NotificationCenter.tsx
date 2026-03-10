import { Bell, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import cn from "classnames";
import { useNotificationStore } from "@/stores/notificationStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { Badge, Button, Text, Divider, Group } from "@mantine/core";
import classes from "./NotificationCenter.module.css";

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <Group gap={8} wrap="nowrap">
          <Bell size={14} color="var(--accent)" />
          <Text size="sm" fw={500} c="var(--text-primary)">
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
      <div className={classes.listScroll}>
        {notifications.length === 0 ? (
          <div className={classes.emptyState}>
            <Bell size={40} strokeWidth={1} />
            <div className={classes.emptyText}>
              <Text size="sm" c="var(--text-primary)">
                No notifications
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Agent events will appear here
              </Text>
            </div>
          </div>
        ) : (
          <ul role="list" className={classes.list}>
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={cn(classes.notificationItem, notification.read ? classes.notificationItemRead : classes.notificationItemUnread)}
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
                <div className={classes.notificationContent}>
                  <div className={classes.notificationRow}>
                    <div className={classes.notificationBody}>
                      <Text
                        size="sm"
                        className={classes.notificationTitle}
                        c={notification.read ? "var(--text-secondary)" : "var(--text-primary)"}
                      >
                        {notification.title}
                      </Text>
                      <Text size="xs" lineClamp={2} c="var(--text-secondary)" mt={2}>
                        {notification.body}
                      </Text>
                    </div>
                    <div className={classes.notificationMeta}>
                      <Text size="xs" c="dimmed">
                        {formatTime(notification.timestamp)}
                      </Text>
                      <ExternalLink size={10} className={classes.jumpIcon} />
                    </div>
                  </div>
                </div>
                <Divider className={classes.divider} color="var(--border)" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
