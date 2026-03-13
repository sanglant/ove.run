import { create } from "zustand";
import type { ContextUnit, ContextUnitType } from "@/types";
import {
  listContextUnits,
  createContextUnit as apiCreateContextUnit,
  updateContextUnit as apiUpdateContextUnit,
  deleteContextUnit as apiDeleteContextUnit,
  searchContextUnits,
} from "@/lib/tauri";

interface ContextState {
  units: ContextUnit[];
  loading: boolean;
  filter: ContextUnitType | "all";
  searchQuery: string;
  setFilter: (filter: ContextUnitType | "all") => void;
  setSearchQuery: (query: string) => void;
  loadUnits: (projectId?: string) => Promise<void>;
  addUnit: (unit: ContextUnit) => Promise<void>;
  editUnit: (unit: ContextUnit) => Promise<void>;
  removeUnit: (id: string) => Promise<void>;
  search: (query: string, projectId?: string) => Promise<void>;
}

export const useContextStore = create<ContextState>((set) => ({
  units: [],
  loading: false,
  filter: "all",
  searchQuery: "",

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  loadUnits: async (projectId) => {
    set({ loading: true });
    try {
      const units = await listContextUnits(projectId);
      set({ units, loading: false });
    } catch (err) {
      console.error("Failed to load context units:", err);
      set({ loading: false });
    }
  },

  addUnit: async (unit) => {
    await apiCreateContextUnit(unit);
    set((s) => ({ units: [unit, ...s.units] }));
  },

  editUnit: async (unit) => {
    await apiUpdateContextUnit(unit);
    set((s) => ({
      units: s.units.map((u) => (u.id === unit.id ? unit : u)),
    }));
  },

  removeUnit: async (id) => {
    await apiDeleteContextUnit(id);
    set((s) => ({ units: s.units.filter((u) => u.id !== id) }));
  },

  search: async (query, projectId) => {
    set({ loading: true });
    try {
      const units = await searchContextUnits(query, projectId);
      set({ units, loading: false });
    } catch (err) {
      console.error("Failed to search context units:", err);
      set({ loading: false });
    }
  },
}));
