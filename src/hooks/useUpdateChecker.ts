import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { checkForUpdates } from "@/lib/tauri";
import { useNotificationStore } from "@/stores/notificationStore";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function checkOnce(showToast: ReturnType<typeof useNotificationStore.getState>["showToast"]) {
  try {
    const info = await checkForUpdates();
    if (info.update_available) {
      const url = info.release_url;
      showToast(
        "info",
        "Update available",
        `Version ${info.latest_version} is available. Click to download.`,
        () => {
          open(url).catch(console.error);
        },
      );
    }
  } catch {
    // Silently ignore — update checks are best-effort
  }
}

export function useUpdateChecker() {
  const { showToast } = useNotificationStore();

  useEffect(() => {
    checkOnce(showToast);

    const interval = setInterval(() => {
      checkOnce(showToast);
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [showToast]);
}
