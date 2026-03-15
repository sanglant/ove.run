import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the underlying Tauri APIs that @/lib/tauri depends on
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

import { useSessionStore } from "./sessionStore";
import type { AgentSession, TerminalProjectLayout } from "@/types";

function makeSession(id: string, projectId: string): AgentSession {
  return {
    id,
    projectId,
    agentType: "claude",
    status: "idle",
    yoloMode: false,
    createdAt: new Date().toISOString(),
    label: `Session ${id}`,
    isResumed: false,
  };
}

function getLayout(): TerminalProjectLayout {
  return useSessionStore.getState().globalLayout;
}

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      globalLayout: {
        mode: "grid",
        root: { type: "pane", id: "pane-0", sessionId: null },
        activePaneId: "pane-0",
      },
    });
  });

  describe("addSession", () => {
    it("adds a session and sets it active", () => {
      const session = makeSession("s1", "p1");
      useSessionStore.getState().addSession(session);

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.activeSessionId).toBe("s1");
    });

    it("creates a layout entry for the session", () => {
      const session = makeSession("s1", "p1");
      useSessionStore.getState().addSession(session);

      const layout = getLayout();
      expect(layout).toBeDefined();
      expect(layout.root.type).toBe("pane");
      if (layout.root.type === "pane") {
        expect(layout.root.sessionId).toBe("s1");
      }
    });

    it("places second session in the active pane", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.activeSessionId).toBe("s2");
    });

    it("places sessions from different projects into the same global layout", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p2"));

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      // Both sessions share the single global layout
      expect(state.globalLayout).toBeDefined();
      expect(state.activeSessionId).toBe("s2");
    });
  });

  describe("removeSession", () => {
    it("removes the session from the list", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().removeSession("s1");

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("s2");
    });

    it("switches active session to the last remaining when removing the active one", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      // s2 is active; remove it — fallback is last element of remaining sessions
      useSessionStore.getState().removeSession("s2");

      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });

    it("preserves active session when removing a different one", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().addSession(makeSession("s3", "p1"));
      // s3 is active; remove s1
      useSessionStore.getState().removeSession("s1");

      expect(useSessionStore.getState().activeSessionId).toBe("s3");
    });

    it("sets activeSessionId to null when removing the only session", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().removeSession("s1");

      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });
  });

  describe("setActiveSession", () => {
    it("updates the active session", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().setActiveSession("s1");

      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });

    it("handles null", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().setActiveSession(null);

      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });

    it("keeps activeSessionId even when session id does not exist in sessions list", () => {
      // setActiveSession does not guard against unknown ids when session is not found
      useSessionStore.getState().setActiveSession("nonexistent");

      expect(useSessionStore.getState().activeSessionId).toBe("nonexistent");
    });
  });

  describe("updateSessionStatus", () => {
    it("updates status without affecting other sessions", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().updateSessionStatus("s1", "working");

      const sessions = useSessionStore.getState().sessions;
      expect(sessions.find((s) => s.id === "s1")?.status).toBe("working");
      expect(sessions.find((s) => s.id === "s2")?.status).toBe("idle");
    });

    it("no-ops for an unknown session id", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().updateSessionStatus("unknown", "working");

      const sessions = useSessionStore.getState().sessions;
      expect(sessions.find((s) => s.id === "s1")?.status).toBe("idle");
    });
  });

  describe("updateSessionYolo", () => {
    it("toggles yolo mode for the target session only", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().updateSessionYolo("s1", true);

      const sessions = useSessionStore.getState().sessions;
      expect(sessions.find((s) => s.id === "s1")?.yoloMode).toBe(true);
      expect(sessions.find((s) => s.id === "s2")?.yoloMode).toBe(false);
    });
  });

  describe("splitPane", () => {
    it("creates a split layout when splitting a pane with a different session", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      // After adding s1 then s2, s2 displaces s1 in the single pane.
      // The active pane contains s2. Split that pane using s1 (which is not yet in any pane).
      const layout = getLayout();
      const activePaneId = layout.activePaneId;

      useSessionStore.getState().splitPane("p1", activePaneId, "right", "s1");

      const updated = getLayout();
      expect(updated.root.type).toBe("split");
    });

    it("sets the split flow to row for left/right zones", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s1");

      const updated = getLayout();
      if (updated.root.type === "split") {
        expect(updated.root.flow).toBe("row");
      } else {
        expect.fail("Expected root to be a split node");
      }
    });

    it("sets the split flow to column for top/bottom zones", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "bottom", "s1");

      const updated = getLayout();
      if (updated.root.type === "split") {
        expect(updated.root.flow).toBe("column");
      } else {
        expect.fail("Expected root to be a split node");
      }
    });

    it("no-ops when sessionId does not exist in the sessions list", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s-unknown");

      const updated = getLayout();
      // Root should still be a pane — no split created
      expect(updated.root.type).toBe("pane");
    });

    it("allows splitting sessions from different projects into the same layout", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p2"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p2", layout.activePaneId, "right", "s1");

      const updated = getLayout();
      expect(updated.root.type).toBe("split");
    });

    it("does not split beyond 8 panes; falls back to placeSessionInLayout", () => {
      function countPanes(node: { type: string; first?: unknown; second?: unknown }): number {
        if (node.type === "pane") return 1;
        return countPanes(node.first as typeof node) + countPanes(node.second as typeof node);
      }

      // Add 9 sessions to the project first so all are valid session ids
      for (let i = 1; i <= 9; i++) {
        useSessionStore.getState().addSession(makeSession(`s${i}`, "p1"));
      }

      // Reset to a single-pane layout with s1, then grow via splitPane until 8 panes
      useSessionStore.setState({
        globalLayout: {
          mode: "grid" as const,
          root: { type: "pane" as const, id: "base-pane", sessionId: "s1" },
          activePaneId: "base-pane",
        },
      });

      // Split 7 more times to reach 8 panes total
      for (let i = 2; i <= 8; i++) {
        const layout = getLayout();
        useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", `s${i}`);
      }

      const layoutAt8 = getLayout();
      expect(countPanes(layoutAt8.root)).toBe(8);

      // Now try to split with s9 — should not increase pane count beyond 8
      useSessionStore.getState().splitPane("p1", layoutAt8.activePaneId, "right", "s9");

      const layoutAfter = getLayout();
      expect(countPanes(layoutAfter.root)).toBeLessThanOrEqual(8);
      // The root must still be a split tree (fallback placed s9, not reset layout)
      expect(layoutAfter.root.type).toBe("split");
    });
  });

  describe("setSplitRatio", () => {
    it("updates the split ratio", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s1");

      const afterSplit = getLayout();
      if (afterSplit.root.type !== "split") {
        expect.fail("Expected a split root after splitPane");
      }
      const splitId = afterSplit.root.id;
      useSessionStore.getState().setSplitRatio("p1", splitId, 0.7);

      const afterResize = getLayout();
      if (afterResize.root.type !== "split") {
        expect.fail("Expected a split root after setSplitRatio");
      }
      expect(afterResize.root.ratio).toBe(0.7);
    });

    it("clamps ratio to [0.1, 0.9]", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s1");

      const afterSplit = getLayout();
      if (afterSplit.root.type !== "split") {
        expect.fail("Expected a split root");
      }
      useSessionStore.getState().setSplitRatio("p1", afterSplit.root.id, 0.0);

      const afterClamp = getLayout();
      if (afterClamp.root.type !== "split") {
        expect.fail("Expected a split root");
      }
      expect(afterClamp.root.ratio).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("focusPane", () => {
    it("updates activePaneId and activeSessionId", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s1");

      const afterSplit = getLayout();
      // Find the pane that holds s1
      function findPaneBySession(node: typeof afterSplit.root, sessionId: string): string | null {
        if (node.type === "pane") return node.sessionId === sessionId ? node.id : null;
        return findPaneBySession(node.first, sessionId) ?? findPaneBySession(node.second, sessionId);
      }
      const s1PaneId = findPaneBySession(afterSplit.root, "s1");
      expect(s1PaneId).not.toBeNull();

      useSessionStore.getState().focusPane("p1", s1PaneId!);

      const state = useSessionStore.getState();
      expect(state.globalLayout.activePaneId).toBe(s1PaneId);
      expect(state.activeSessionId).toBe("s1");
    });
  });

  describe("reorderSessions", () => {
    it("reorders sessions within a project (scoped)", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));
      useSessionStore.getState().addSession(makeSession("s3", "p1"));

      // Drag s3 before s1
      useSessionStore.getState().reorderSessions("s3", "s1", "p1");

      const ids = useSessionStore.getState().sessions.map((s) => s.id);
      expect(ids).toEqual(["s3", "s1", "s2"]);
    });

    it("reorders sessions globally (no projectId)", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p2"));
      useSessionStore.getState().addSession(makeSession("s3", "p1"));

      // Drag s3 before s1 globally
      useSessionStore.getState().reorderSessions("s3", "s1");

      const ids = useSessionStore.getState().sessions.map((s) => s.id);
      expect(ids).toEqual(["s3", "s1", "s2"]);
    });

    it("no-ops when dragged id equals target id", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      useSessionStore.getState().reorderSessions("s1", "s1", "p1");

      const ids = useSessionStore.getState().sessions.map((s) => s.id);
      expect(ids).toEqual(["s1", "s2"]);
    });

    it("keeps cross-project sessions in place when reordering within a project", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p2"));
      useSessionStore.getState().addSession(makeSession("s3", "p1"));

      // Drag s3 before s1 within p1 — s2 (p2) should stay in position 1
      useSessionStore.getState().reorderSessions("s3", "s1", "p1");

      const ids = useSessionStore.getState().sessions.map((s) => s.id);
      expect(ids[1]).toBe("s2");
    });
  });

  describe("setLayoutMode", () => {
    it("changes the layout mode", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));

      useSessionStore.getState().setLayoutMode("p1", "single");

      expect(getLayout().mode).toBe("single");
    });
  });

  describe("setPaneSession", () => {
    it("assigns a session to an existing pane", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));
      useSessionStore.getState().addSession(makeSession("s2", "p1"));

      const layout = getLayout();
      useSessionStore.getState().splitPane("p1", layout.activePaneId, "right", "s1");

      // Find the pane that currently holds s2
      const afterSplit = getLayout();
      function findPaneBySession(node: typeof afterSplit.root, sessionId: string): string | null {
        if (node.type === "pane") return node.sessionId === sessionId ? node.id : null;
        return findPaneBySession(node.first, sessionId) ?? findPaneBySession(node.second, sessionId);
      }
      const s2PaneId = findPaneBySession(afterSplit.root, "s2");
      expect(s2PaneId).not.toBeNull();

      useSessionStore.getState().setPaneSession("p1", s2PaneId!, "s1");

      // s1 should now be in the s2 pane; active session should update
      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });

    it("clears a pane session when null is passed", () => {
      useSessionStore.getState().addSession(makeSession("s1", "p1"));

      const layout = getLayout();
      const paneId = layout.activePaneId;

      useSessionStore.getState().setPaneSession("p1", paneId, null);

      const updated = getLayout();
      if (updated.root.type === "pane") {
        expect(updated.root.sessionId).toBeNull();
      } else {
        expect.fail("Expected pane root");
      }
    });
  });
});
