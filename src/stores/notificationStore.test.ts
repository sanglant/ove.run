import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useNotificationStore } from "./notificationStore";

function makeNotification(id: string) {
  return {
    id,
    title: `Notification ${id}`,
    body: "body text",
    sessionId: "session-1",
    timestamp: new Date().toISOString(),
  };
}

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], toasts: [] });
  });

  describe("addNotification", () => {
    it("adds a notification with read=false", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe("n1");
      expect(state.notifications[0].read).toBe(false);
    });

    it("prepends notifications so the newest is first", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));
      useNotificationStore.getState().addNotification(makeNotification("n2"));

      const ids = useNotificationStore.getState().notifications.map((n) => n.id);
      expect(ids).toEqual(["n2", "n1"]);
    });

    it("caps the list at MAX_NOTIFICATIONS (500) and drops the oldest entries", () => {
      // Pre-fill with 500 notifications (already-stored items have read flag)
      const initial = Array.from({ length: 500 }, (_, i) => ({ ...makeNotification(`old-${i}`), read: false }));
      useNotificationStore.setState({ notifications: initial });

      // Add one more — this should displace the oldest
      useNotificationStore.getState().addNotification(makeNotification("newest"));

      const notifications = useNotificationStore.getState().notifications;
      expect(notifications).toHaveLength(500);
      expect(notifications[0].id).toBe("newest");
      // The 500th oldest should have been dropped
      expect(notifications.find((n) => n.id === "old-499")).toBeUndefined();
    });
  });

  describe("markRead", () => {
    it("marks a single notification as read", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));
      useNotificationStore.getState().addNotification(makeNotification("n2"));
      useNotificationStore.getState().markRead("n1");

      const notifications = useNotificationStore.getState().notifications;
      expect(notifications.find((n) => n.id === "n1")?.read).toBe(true);
      expect(notifications.find((n) => n.id === "n2")?.read).toBe(false);
    });

    it("no-ops for unknown id", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));
      useNotificationStore.getState().markRead("unknown");

      expect(useNotificationStore.getState().notifications[0].read).toBe(false);
    });
  });

  describe("markAllRead", () => {
    it("marks every notification as read", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));
      useNotificationStore.getState().addNotification(makeNotification("n2"));
      useNotificationStore.getState().markAllRead();

      const all = useNotificationStore.getState().notifications;
      expect(all.every((n) => n.read)).toBe(true);
    });
  });

  describe("clearAll", () => {
    it("removes all notifications", () => {
      useNotificationStore.getState().addNotification(makeNotification("n1"));
      useNotificationStore.getState().addNotification(makeNotification("n2"));
      useNotificationStore.getState().clearAll();

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });

  describe("showToast", () => {
    it("adds a toast with the correct level and title", () => {
      useNotificationStore.getState().showToast("info", "Test toast", "Details here");

      const toasts = useNotificationStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].level).toBe("info");
      expect(toasts[0].title).toBe("Test toast");
      expect(toasts[0].body).toBe("Details here");
    });

    it("uses 8000ms duration for error toasts", () => {
      useNotificationStore.getState().showToast("error", "Error!");
      expect(useNotificationStore.getState().toasts[0].duration).toBe(8000);
    });

    it("uses 4000ms duration for non-error toasts", () => {
      useNotificationStore.getState().showToast("info", "Info");
      expect(useNotificationStore.getState().toasts[0].duration).toBe(4000);
    });
  });

  describe("dismissToast", () => {
    it("removes the matching toast and leaves others", () => {
      useNotificationStore.getState().showToast("info", "First");
      useNotificationStore.getState().showToast("success", "Second");

      const id = useNotificationStore.getState().toasts[0].id;
      useNotificationStore.getState().dismissToast(id);

      const toasts = useNotificationStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].title).toBe("Second");
    });
  });
});
