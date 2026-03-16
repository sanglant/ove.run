import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { NotificationItem, ToastItem, ToastLevel } from "@/types";

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastItem[];
  addNotification: (notification: Omit<NotificationItem, "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  showToast: (level: ToastLevel, title: string, body?: string, onClick?: () => void) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],

  addNotification: (notification) => {
    const item: NotificationItem = { ...notification, read: false };
    set((state) => ({
      notifications: [item, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id: string) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  showToast: (level: ToastLevel, title: string, body?: string, onClick?: () => void) => {
    const toast: ToastItem = {
      id: uuid(),
      level,
      title,
      body,
      duration: level === "error" ? 8000 : 4000,
      onClick,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
  },

  dismissToast: (id: string) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
