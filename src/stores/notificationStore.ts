import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { NotificationItem, ToastItem, ToastLevel } from "@/types";

const MAX_NOTIFICATIONS = 500;

interface NotificationState {
  notifications: NotificationItem[];
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
  toasts: [],

  addNotification: (notification) => {
    const item: NotificationItem = { ...notification, read: false };
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
    }));
  },

  markRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
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
