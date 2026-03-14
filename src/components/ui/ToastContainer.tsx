import { useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import type { ToastLevel } from "@/types";
import classes from "./ToastContainer.module.css";

const ICONS: Record<ToastLevel, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const COLORS: Record<ToastLevel, string> = {
  error: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
  info: "var(--accent)",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useNotificationStore();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const toast of toasts) {
      if (timers.current.has(toast.id)) continue;
      const timer = setTimeout(() => {
        dismissToast(toast.id);
        timers.current.delete(toast.id);
      }, toast.duration ?? 4000);
      timers.current.set(toast.id, timer);
    }

    for (const [id, timer] of timers.current) {
      if (!toasts.some((t) => t.id === id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={classes.container}>
      {toasts.map((toast) => {
        const Icon = ICONS[toast.level];
        return (
          <div
            key={toast.id}
            className={classes.toast}
            data-level={toast.level}
            onClick={() => dismissToast(toast.id)}
          >
            <Icon size={16} className={classes.icon} color={COLORS[toast.level]} />
            <div className={classes.content}>
              <div className={classes.title}>{toast.title}</div>
              {toast.body && <div className={classes.body}>{toast.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
