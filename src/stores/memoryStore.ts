import { create } from "zustand";
import type { Memory, Consolidation } from "@/types";
import {
  listMemories,
  listConsolidations,
  searchMemories as apiSearchMemories,
  toggleMemoryVisibility,
  deleteMemory,
} from "@/lib/tauri";

interface MemoryState {
  memories: Memory[];
  consolidations: Consolidation[];
  loading: boolean;
  loadMemories: (projectId: string, sessionId?: string) => Promise<void>;
  loadConsolidations: (projectId: string) => Promise<void>;
  search: (query: string, projectId: string) => Promise<void>;
  toggleVisibility: (id: string, visibility: "private" | "public") => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
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
    await toggleMemoryVisibility(id, visibility);
    set((s) => ({
      memories: s.memories.map((m) =>
        m.id === id ? { ...m, visibility } : m,
      ),
    }));
  },

  removeMemory: async (id) => {
    await deleteMemory(id);
    set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
  },
}));
