import { create } from "zustand";

type ActivePanel = "terminal" | "git" | "knowledge" | "settings" | "notifications";

interface UiState {
  activePanel: ActivePanel;
  sidebarCollapsed: boolean;
  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "terminal",
  sidebarCollapsed: false,

  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
