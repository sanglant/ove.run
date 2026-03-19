import { create } from "zustand";
import type { ArbiterState, Story, TrustLevel } from "@/types";
import {
  getArbiterState,
  setTrustLevel as apiSetTrustLevel,
  listStories,
  decomposeRequest as apiDecomposeRequest,
} from "@/lib/tauri";
import { useNotificationStore } from "./notificationStore";

interface ArbiterStoreState {
  arbiterState: Record<string, ArbiterState>;
  stories: Record<string, Story[]>;
  loading: boolean;
  loadArbiterState: (projectId: string) => Promise<void>;
  setTrustLevel: (projectId: string, level: TrustLevel) => Promise<void>;
  loadStories: (projectId: string) => Promise<void>;
  decompose: (projectId: string, projectPath: string, request: string) => Promise<void>;
}

export const useArbiterStore = create<ArbiterStoreState>((set, get) => ({
  arbiterState: {},
  stories: {},
  loading: false,

  loadArbiterState: async (projectId) => {
    set({ loading: true });
    try {
      const state = await getArbiterState(projectId);
      if (state) {
        set((s) => ({
          arbiterState: { ...s.arbiterState, [projectId]: state },
          loading: false,
        }));
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.error("Failed to load arbiter state:", err);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to load arbiter state", String(err));
    }
  },

  setTrustLevel: async (projectId, level) => {
    try {
      await apiSetTrustLevel(projectId, level);
      const current = get().arbiterState[projectId];
      if (current) {
        set((s) => ({
          arbiterState: {
            ...s.arbiterState,
            [projectId]: { ...current, trust_level: level },
          },
        }));
      }
    } catch (err) {
      console.error("Failed to set trust level:", err);
      useNotificationStore.getState().showToast("error", "Failed to set trust level", String(err));
    }
  },

  loadStories: async (projectId) => {
    set({ loading: true });
    try {
      const stories = await listStories(projectId);
      set((s) => ({
        stories: { ...s.stories, [projectId]: stories },
        loading: false,
      }));
    } catch (err) {
      console.error("Failed to load stories:", err);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to load stories", String(err));
    }
  },

  decompose: async (projectId, projectPath, request) => {
    set({ loading: true });
    try {
      const stories = await apiDecomposeRequest(projectId, projectPath, request);
      set((s) => ({
        stories: { ...s.stories, [projectId]: stories },
        loading: false,
      }));
    } catch (err) {
      console.error("Failed to decompose request:", err);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to decompose request", String(err));
    }
  },
}));
