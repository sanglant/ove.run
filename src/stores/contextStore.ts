import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { ContextUnit, ContextUnitType } from "@/types";
import {
  listContextUnits,
  createContextUnit as apiCreateContextUnit,
  updateContextUnit as apiUpdateContextUnit,
  deleteContextUnit as apiDeleteContextUnit,
  searchContextUnits,
} from "@/lib/tauri";
import { useNotificationStore } from "./notificationStore";

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
  duplicateUnit: (unit: ContextUnit) => Promise<void>;
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
      useNotificationStore.getState().showToast("error", "Failed to load context units", String(err));
    }
  },

  addUnit: async (unit) => {
    try {
      await apiCreateContextUnit(unit);
      set((s) => ({ units: [unit, ...s.units] }));
    } catch (err) {
      console.error("Failed to create context unit:", err);
      useNotificationStore.getState().showToast("error", "Failed to create context unit", String(err));
      throw err;
    }
  },

  editUnit: async (unit) => {
    try {
      await apiUpdateContextUnit(unit);
      set((s) => ({
        units: s.units.map((u) => (u.id === unit.id ? unit : u)),
      }));
    } catch (err) {
      console.error("Failed to edit context unit:", err);
      useNotificationStore.getState().showToast("error", "Failed to edit context unit", String(err));
      throw err;
    }
  },

  removeUnit: async (id) => {
    try {
      await apiDeleteContextUnit(id);
      set((s) => ({ units: s.units.filter((u) => u.id !== id) }));
    } catch (err) {
      console.error("Failed to delete context unit:", err);
      useNotificationStore.getState().showToast("error", "Failed to delete context unit", String(err));
      throw err;
    }
  },

  duplicateUnit: async (unit) => {
    const newUnit: ContextUnit = {
      ...unit,
      id: uuid(),
      name: `Custom — ${unit.name}`,
      is_bundled: false,
      bundled_slug: null,
    };
    try {
      await apiCreateContextUnit(newUnit);
      set((s) => ({ units: [newUnit, ...s.units] }));
    } catch (err) {
      console.error("Failed to duplicate context unit:", err);
      useNotificationStore.getState().showToast("error", "Failed to duplicate context unit", String(err));
      throw err;
    }
  },

  search: async (query, projectId) => {
    set({ loading: true });
    try {
      const units = await searchContextUnits(query, projectId);
      set({ units, loading: false });
    } catch (err) {
      console.error("Failed to search context units:", err);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to search context units", String(err));
    }
  },
}));
