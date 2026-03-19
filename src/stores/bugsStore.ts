import { create } from "zustand";
import { BugItem, ProviderConfig } from "../features/bugs/types";
import * as tauri from "../lib/tauri";
import { useNotificationStore } from "./notificationStore";

interface BugsState {
  bugs: BugItem[];
  selectedBug: BugItem | null;
  loading: boolean;
  providerConfig: ProviderConfig | null;
  authenticated: boolean;
  loadConfig: (projectId: string) => Promise<void>;
  loadBugs: (projectId: string) => Promise<void>;
  selectBug: (projectId: string, bug: BugItem) => Promise<void>;
  clearSelection: () => void;
  reset: () => void;
}

export const useBugsStore = create<BugsState>((set) => ({
  bugs: [],
  selectedBug: null,
  loading: false,
  providerConfig: null,
  authenticated: false,

  loadConfig: async (projectId: string) => {
    try {
      const config = await tauri.getBugProviderConfig(projectId);
      const authed = config ? await tauri.checkBugAuth(projectId) : false;
      set({ providerConfig: config, authenticated: authed });
    } catch (e) {
      console.error("Failed to load bug config:", e);
      useNotificationStore.getState().showToast("error", "Failed to load bug tracker config", String(e));
    }
  },

  loadBugs: async (projectId: string) => {
    set({ loading: true });
    try {
      const bugs = await tauri.listBugs(projectId);
      set({ bugs, loading: false });
    } catch (e) {
      console.error("Failed to load bugs:", e);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to load bugs", String(e));
    }
  },

  selectBug: async (projectId: string, bug: BugItem) => {
    try {
      const detail = await tauri.getBugDetail(projectId, bug.id);
      set({ selectedBug: detail });
    } catch (e) {
      console.error("Failed to load bug detail:", e);
      useNotificationStore.getState().showToast("error", "Failed to load bug detail", String(e));
      set({ selectedBug: bug });
    }
  },

  clearSelection: () => set({ selectedBug: null }),

  reset: () => set({
    bugs: [],
    selectedBug: null,
    loading: false,
    providerConfig: null,
    authenticated: false,
  }),
}));
