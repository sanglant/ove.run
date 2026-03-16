import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { useNotificationStore } from "@/stores/notificationStore";

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_url: string;
  release_notes: string | null;
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function checkOnce(showToast: ReturnType<typeof useNotificationStore.getState>["showToast"]) {
  try {
    const info = await invoke<UpdateInfo>("check_for_updates");
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
