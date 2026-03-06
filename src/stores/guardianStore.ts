import { create } from "zustand";

interface GuardianState {
  guardianInitialized: Record<string, boolean>;
  setGuardianInitialized: (projectId: string, initialized: boolean) => void;
  clearProjectGuardianState: (projectId: string) => void;
}

export const useGuardianStore = create<GuardianState>((set) => ({
  guardianInitialized: {},

  setGuardianInitialized: (projectId: string, initialized: boolean) => {
    set((state) => ({
      guardianInitialized: { ...state.guardianInitialized, [projectId]: initialized },
    }));
  },

  clearProjectGuardianState: (projectId: string) => {
    set((state) => {
      const guardianInitialized = { ...state.guardianInitialized };
      delete guardianInitialized[projectId];
      return { guardianInitialized };
    });
  },
}));
