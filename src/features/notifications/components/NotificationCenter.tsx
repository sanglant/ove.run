import { Bell, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import cn from "clsx";
import { useNotificationStore } from "@/stores/notificationStore";
import { useSessionStore } from "@/stores/sessionStore";
import { formatRelativeTime } from "@/lib/formatTime";
import { useUiStore } from "@/stores/uiStore";
import { Badge, Button, Text, Divider, Group } from "@mantine/core";
import { EmptyState } from "@/components/ui/EmptyState";
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
          <EmptyState
            icon={<Bell size={40} strokeWidth={1} />}
            title="No notifications"
            description="Agent events will appear here"
          />
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
                        {formatRelativeTime(notification.timestamp)}
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
