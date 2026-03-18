import { create } from "zustand";
import type { Memory, Consolidation } from "@/types";
import {
  listMemories,
  listConsolidations,
  searchMemories as apiSearchMemories,
  toggleMemoryVisibility,
  deleteMemory,
  deleteAllMemories,
} from "@/lib/tauri";
import { useNotificationStore } from "./notificationStore";

interface MemoryState {
  memories: Memory[];
  consolidations: Consolidation[];
  loading: boolean;
  loadMemories: (projectId: string, sessionId?: string) => Promise<void>;
  loadConsolidations: (projectId: string) => Promise<void>;
  search: (query: string, projectId: string) => Promise<void>;
  toggleVisibility: (id: string, visibility: "private" | "public") => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
  clearAllMemories: (projectId: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  consolidations: [],
  loading: false,

  loadMemories: async (projectId, sessionId) => {
    set({ loading: true });
    try {
      const memories = await listMemories(projectId, sessionId);
      set({ memories, loading: false });
    } catch (err) {
      console.error("Failed to load memories:", err);
      set({ loading: false });
    }
  },

  loadConsolidations: async (projectId) => {
    set({ loading: true });
    try {
      const consolidations = await listConsolidations(projectId);
      set({ consolidations, loading: false });
    } catch (err) {
      console.error("Failed to load consolidations:", err);
      set({ loading: false });
    }
  },

  search: async (query, projectId) => {
    set({ loading: true });
    try {
      const memories = await apiSearchMemories(query, projectId);
      set({ memories, loading: false });
    } catch (err) {
      console.error("Failed to search memories:", err);
      set({ loading: false });
    }
  },

  toggleVisibility: async (id, visibility) => {
    try {
      await toggleMemoryVisibility(id, visibility);
      set((s) => ({
        memories: s.memories.map((m) =>
          m.id === id ? { ...m, visibility } : m,
        ),
      }));
    } catch (err) {
      console.error("Failed to toggle memory visibility:", err);
      useNotificationStore.getState().showToast("error", "Failed to update memory visibility", String(err));
      throw err;
    }
  },

  removeMemory: async (id) => {
    try {
      await deleteMemory(id);
      set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
    } catch (err) {
      console.error("Failed to remove memory:", err);
      useNotificationStore.getState().showToast("error", "Failed to remove memory", String(err));
      throw err;
    }
  },

  clearAllMemories: async (projectId) => {
    try {
      await deleteAllMemories(projectId);
      set({ memories: [], consolidations: [] });
    } catch (err) {
      console.error("Failed to clear all memories:", err);
      useNotificationStore.getState().showToast("error", "Failed to clear memories", String(err));
      throw err;
    }
  },
}));
