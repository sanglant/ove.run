import { create } from "zustand";

interface ArbiterState {
  arbiterInitialized: Record<string, boolean>;
  setArbiterInitialized: (projectId: string, initialized: boolean) => void;
  clearProjectArbiterState: (projectId: string) => void;
}

export const useArbiterStore = create<ArbiterState>((set) => ({
  arbiterInitialized: {},

  setArbiterInitialized: (projectId: string, initialized: boolean) => {
    set((state) => ({
      arbiterInitialized: { ...state.arbiterInitialized, [projectId]: initialized },
    }));
  },

  clearProjectArbiterState: (projectId: string) => {
    set((state) => {
      const arbiterInitialized = { ...state.arbiterInitialized };
      delete arbiterInitialized[projectId];
      return { arbiterInitialized };
    });
  },
}));
