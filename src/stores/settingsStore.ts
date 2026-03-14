import { create } from "zustand";
import type { AppSettings } from "@/types";
import {
  getSettings as apiGetSettings,
  updateSettings as apiUpdateSettings,
  getSandboxCapabilities,
} from "@/lib/tauri";

const DEFAULT_SETTINGS: AppSettings = {
  global: {
    theme: "dark",
    font_family: "JetBrains Mono",
    font_size: 14,
    notifications_enabled: true,
    minimize_to_tray: false,
    terminal_scrollback: 10000,
    arbiter_timeout_seconds: 20,
    arbiter_provider: "",
    arbiter_model: "",
  },
  agents: {
    claude: {
      default_yolo_mode: false,
      custom_args: [],
      env_vars: {},
    },
    gemini: {
      default_yolo_mode: false,
      custom_args: [],
      env_vars: {},
    },
  },
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  sandboxAvailable: boolean;
  sandboxPlatform: string;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  loadSandboxCapabilities: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  sandboxAvailable: false,
  sandboxPlatform: "",

  loadSettings: async () => {
    set({ loading: true });
    try {
      const settings = await apiGetSettings();
      set({ settings, loading: false });
    } catch (err) {
      console.error("Failed to load settings:", err);
      // Keep defaults on error
      set({ loading: false });
    }
  },

  updateSettings: async (settings: AppSettings) => {
    try {
      await apiUpdateSettings(settings);
      set({ settings });
    } catch (err) {
      console.error("Failed to update settings:", err);
      throw err;
    }
  },

  loadSandboxCapabilities: async () => {
    try {
      const caps = await getSandboxCapabilities();
      set({ sandboxAvailable: caps.available, sandboxPlatform: caps.platform });
    } catch {
      set({ sandboxAvailable: false, sandboxPlatform: "" });
    }
  },
}));
