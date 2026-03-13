import { create } from "zustand";

type ActivePanel =
  | "terminal"
  | "git"
  | "context"
  | "notes"
  | "bugs"
  | "memory"
  | "loop"
  | "settings"
  | "notifications";
export type TabViewMode = "grouped" | "flat";
export type EditorLayoutMode = "write" | "split" | "raw";

interface UiState {
  activePanel: ActivePanel;
  sidebarCollapsed: boolean;
  tabViewMode: TabViewMode;
  editorLayoutMode: EditorLayoutMode;
  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;
  setTabViewMode: (mode: TabViewMode) => void;
  setEditorLayoutMode: (mode: EditorLayoutMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "terminal",
  sidebarCollapsed: false,
  tabViewMode: "grouped",
  editorLayoutMode: "write",

  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setTabViewMode: (mode: TabViewMode) => {
    set({ tabViewMode: mode });
  },

  setEditorLayoutMode: (mode: EditorLayoutMode) => {
    set({ editorLayoutMode: mode });
  },
}));
