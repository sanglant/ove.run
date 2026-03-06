import { create } from "zustand";

type ActivePanel = "terminal" | "git" | "knowledge" | "notes" | "settings" | "notifications";
export type TabViewMode = "grouped" | "flat";

interface UiState {
  activePanel: ActivePanel;
  sidebarCollapsed: boolean;
  tabViewMode: TabViewMode;
  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;
  setTabViewMode: (mode: TabViewMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "terminal",
  sidebarCollapsed: false,
  tabViewMode: "grouped",

  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setTabViewMode: (mode: TabViewMode) => {
    set({ tabViewMode: mode });
  },
}));
