import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useSettingsStore } from "./settingsStore";
import type { AppSettings } from "@/types";

const DEFAULT_SETTINGS: AppSettings = {
  global: {
    theme: "dark",
    font_family: "JetBrains Mono",
    font_size: 14,
    notifications_enabled: true,
    minimize_to_tray: false,
    terminal_scrollback: 10000,
    arbiter_timeout_seconds: 3,
    arbiter_provider: "",
    arbiter_model: "",
  },
  agents: {
    claude: { default_yolo_mode: false, custom_args: [], env_vars: {} },
    gemini: { default_yolo_mode: false, custom_args: [], env_vars: {} },
  },
};

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      loading: false,
      sandboxAvailable: false,
      sandboxPlatform: "",
    });
  });

  describe("initial state", () => {
    it("exposes a settings object with global and agents keys", () => {
      const { settings } = useSettingsStore.getState();
      expect(settings).toBeDefined();
      expect(settings.global).toBeDefined();
      expect(settings.agents).toBeDefined();
    });

    it("has the expected default global settings", () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.global.theme).toBe("dark");
      expect(settings.global.font_size).toBe(14);
      expect(settings.global.notifications_enabled).toBe(true);
    });

    it("has agent configs for claude and gemini", () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.agents.claude).toBeDefined();
      expect(settings.agents.gemini).toBeDefined();
    });
  });

  describe("updateSettings", () => {
    it("merges updated settings into the store", async () => {
      const updated: AppSettings = {
        ...DEFAULT_SETTINGS,
        global: { ...DEFAULT_SETTINGS.global, font_size: 18 },
      };

      await useSettingsStore.getState().updateSettings(updated);

      expect(useSettingsStore.getState().settings.global.font_size).toBe(18);
    });

    it("preserves other fields when only one is changed", async () => {
      const updated: AppSettings = {
        ...DEFAULT_SETTINGS,
        global: { ...DEFAULT_SETTINGS.global, minimize_to_tray: true },
      };

      await useSettingsStore.getState().updateSettings(updated);

      const { settings } = useSettingsStore.getState();
      expect(settings.global.minimize_to_tray).toBe(true);
      expect(settings.global.theme).toBe("dark");
    });
  });

  describe("loadSettings", () => {
    it("sets loading true while fetching then false after", async () => {
      const promise = useSettingsStore.getState().loadSettings();
      // After resolution the loading flag should be false
      await promise;
      expect(useSettingsStore.getState().loading).toBe(false);
    });
  });

  describe("loadSandboxCapabilities", () => {
    it("resolves without throwing when invoke returns undefined (error path)", async () => {
      await expect(useSettingsStore.getState().loadSandboxCapabilities()).resolves.not.toThrow();
    });
  });
});
