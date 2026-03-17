import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      activePanel: "terminal",
      sidebarCollapsed: false,
      tabViewMode: "grouped",
      editorLayoutMode: "write",
    });
  });

  describe("setActivePanel", () => {
    it("updates the active panel", () => {
      useUiStore.getState().setActivePanel("git");
      expect(useUiStore.getState().activePanel).toBe("git");
    });

    it("can set every valid panel value", () => {
      const panels = ["terminal", "git", "context", "notes", "bugs", "memory", "settings", "notifications", "stats"] as const;
      for (const panel of panels) {
        useUiStore.getState().setActivePanel(panel);
        expect(useUiStore.getState().activePanel).toBe(panel);
      }
    });
  });

  describe("toggleSidebar", () => {
    it("collapses the sidebar when it was open", () => {
      useUiStore.setState({ sidebarCollapsed: false });
      useUiStore.getState().toggleSidebar();
      expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    });

    it("expands the sidebar when it was collapsed", () => {
      useUiStore.setState({ sidebarCollapsed: true });
      useUiStore.getState().toggleSidebar();
      expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    });

    it("toggles back and forth correctly", () => {
      useUiStore.getState().toggleSidebar();
      useUiStore.getState().toggleSidebar();
      expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("setTabViewMode", () => {
    it("sets mode to flat", () => {
      useUiStore.getState().setTabViewMode("flat");
      expect(useUiStore.getState().tabViewMode).toBe("flat");
    });

    it("sets mode back to grouped", () => {
      useUiStore.setState({ tabViewMode: "flat" });
      useUiStore.getState().setTabViewMode("grouped");
      expect(useUiStore.getState().tabViewMode).toBe("grouped");
    });
  });

  describe("setEditorLayoutMode", () => {
    it("sets mode to split", () => {
      useUiStore.getState().setEditorLayoutMode("split");
      expect(useUiStore.getState().editorLayoutMode).toBe("split");
    });

    it("sets mode to raw", () => {
      useUiStore.getState().setEditorLayoutMode("raw");
      expect(useUiStore.getState().editorLayoutMode).toBe("raw");
    });

    it("sets mode back to write", () => {
      useUiStore.setState({ editorLayoutMode: "raw" });
      useUiStore.getState().setEditorLayoutMode("write");
      expect(useUiStore.getState().editorLayoutMode).toBe("write");
    });
  });
});
