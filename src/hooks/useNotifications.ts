import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNotificationStore } from "@/stores/notificationStore";
import type { NotificationItem } from "@/types";

export function useNotifications() {
  const { addNotification, unreadCount } = useNotificationStore();

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    listen<Omit<NotificationItem, "read">>("notification", (event) => {
      if (cancelled) return;
      addNotification(event.payload);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addNotification]);

  return { unreadCount };
}
