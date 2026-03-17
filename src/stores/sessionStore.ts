import { create } from "zustand";
import type {
  AgentSession,
  AgentStatus,
  PersistedSession,
  TerminalLayoutMode,
  TerminalLayoutNode,
  TerminalPaneDropZone,
  TerminalPaneLayoutNode,
  TerminalProjectLayout,
  TerminalSplitFlow,
  TerminalSplitLayoutNode,
} from "@/types";
import { saveSessions, loadSessions } from "@/lib/tauri";
import { collectPanes, countPanes, findPaneById } from "@/lib/layout";
import { useNotificationStore } from "./notificationStore";

const MAX_GRID_PANES = 8;
const DEFAULT_SPLIT_RATIO = 0.5;
const MIN_SPLIT_RATIO = 0.1;

let layoutNodeSequence = 0;

function createNodeId(prefix: "pane" | "split"): string {
  layoutNodeSequence += 1;
  return `${prefix}-${layoutNodeSequence}`;
}

function clampRatio(ratio: number): number {
  const safeRatio = Number.isFinite(ratio) ? ratio : DEFAULT_SPLIT_RATIO;
  return Math.min(Math.max(safeRatio, MIN_SPLIT_RATIO), 1 - MIN_SPLIT_RATIO);
}

function createPane(sessionId: string | null = null): TerminalPaneLayoutNode {
  return {
    type: "pane",
    id: createNodeId("pane"),
    sessionId,
  };
}

function createSplit(
  flow: TerminalSplitFlow,
  first: TerminalLayoutNode,
  second: TerminalLayoutNode,
  ratio = DEFAULT_SPLIT_RATIO,
): TerminalSplitLayoutNode {
  return {
    type: "split",
    id: createNodeId("split"),
    flow,
    ratio: clampRatio(ratio),
    first,
    second,
  };
}

function createLayout(initialSessionId: string | null = null): TerminalProjectLayout {
  const root = createPane(initialSessionId);
  return {
    mode: "grid",
    root,
    activePaneId: root.id,
  };
}

function findPaneBySession(node: TerminalLayoutNode, sessionId: string): TerminalPaneLayoutNode | null {
  if (node.type === "pane") {
    return node.sessionId === sessionId ? node : null;
  }

  return findPaneBySession(node.first, sessionId) ?? findPaneBySession(node.second, sessionId);
}

function hasAssignedSession(node: TerminalLayoutNode): boolean {
  return collectPanes(node).some((pane) => Boolean(pane.sessionId));
}

function updatePane(
  node: TerminalLayoutNode,
  paneId: string,
  updater: (pane: TerminalPaneLayoutNode) => TerminalPaneLayoutNode,
): TerminalLayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? updater(node) : node;
  }

  return {
    ...node,
    first: updatePane(node.first, paneId, updater),
    second: updatePane(node.second, paneId, updater),
  };
}

function replacePane(
  node: TerminalLayoutNode,
  paneId: string,
  replacement: TerminalLayoutNode,
): TerminalLayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? replacement : node;
  }

  return {
    ...node,
    first: replacePane(node.first, paneId, replacement),
    second: replacePane(node.second, paneId, replacement),
  };
}

function removeArtifactsPanes(node: TerminalLayoutNode): TerminalLayoutNode | null {
  if (node.type === "pane") {
    return node.paneType === "artifacts" ? null : node;
  }

  const nextFirst = removeArtifactsPanes(node.first);
  if (!nextFirst) {
    return removeArtifactsPanes(node.second);
  }

  const nextSecond = removeArtifactsPanes(node.second);
  if (!nextSecond) {
    return nextFirst;
  }

  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }

  return {
    ...node,
    first: nextFirst,
    second: nextSecond,
  };
}

function removePane(node: TerminalLayoutNode, paneId: string): TerminalLayoutNode | null {
  if (node.type === "pane") {
    return node.id === paneId ? null : node;
  }

  const nextFirst = removePane(node.first, paneId);
  if (!nextFirst) {
    return node.second;
  }

  const nextSecond = removePane(node.second, paneId);
  if (!nextSecond) {
    return nextFirst;
  }

  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }

  return {
    ...node,
    first: nextFirst,
    second: nextSecond,
  };
}

function updateSplitNode(
  node: TerminalLayoutNode,
  splitId: string,
  updater: (split: TerminalSplitLayoutNode) => TerminalSplitLayoutNode,
): TerminalLayoutNode {
  if (node.type === "pane") {
    return node;
  }

  if (node.id === splitId) {
    return updater(node);
  }

  return {
    ...node,
    first: updateSplitNode(node.first, splitId, updater),
    second: updateSplitNode(node.second, splitId, updater),
  };
}

function sanitizeNode(
  node: TerminalLayoutNode,
  validSessionIds: Set<string>,
  usedSessionIds: Set<string>,
): TerminalLayoutNode {
  if (node.type === "pane") {
    const sessionId =
      node.sessionId && validSessionIds.has(node.sessionId) && !usedSessionIds.has(node.sessionId)
        ? node.sessionId
        : null;

    if (sessionId) {
      usedSessionIds.add(sessionId);
    }

    return {
      ...node,
      sessionId,
    };
  }

  return {
    ...node,
    ratio: clampRatio(node.ratio),
    first: sanitizeNode(node.first, validSessionIds, usedSessionIds),
    second: sanitizeNode(node.second, validSessionIds, usedSessionIds),
  };
}

function resolveTargetPaneId(layout: TerminalProjectLayout, targetPaneId?: string): string | null {
  const panes = collectPanes(layout.root);
  if (panes.length === 0) {
    return null;
  }

  if (targetPaneId && panes.some((pane) => pane.id === targetPaneId)) {
    return targetPaneId;
  }

  const emptyPane = panes.find((pane) => !pane.sessionId);
  if (emptyPane) {
    return emptyPane.id;
  }

  if (panes.some((pane) => pane.id === layout.activePaneId)) {
    return layout.activePaneId;
  }

  return panes[0].id;
}

function placeSessionInLayout(
  layout: TerminalProjectLayout,
  sessionId: string,
  targetPaneId?: string,
): TerminalProjectLayout {
  const safeTargetPaneId = resolveTargetPaneId(layout, targetPaneId);
  if (!safeTargetPaneId) {
    return layout;
  }

  const targetPane = findPaneById(layout.root, safeTargetPaneId);
  if (!targetPane) {
    return layout;
  }

  const existingPane = findPaneBySession(layout.root, sessionId);

  if (existingPane?.id === safeTargetPaneId) {
    return {
      ...layout,
      activePaneId: safeTargetPaneId,
    };
  }

  let root = layout.root;

  if (existingPane) {
    const displacedSessionId = targetPane.sessionId;
    root = updatePane(root, existingPane.id, (pane) => ({
      ...pane,
      sessionId: displacedSessionId ?? null,
    }));
    root = updatePane(root, safeTargetPaneId, (pane) => ({
      ...pane,
      sessionId,
    }));
  } else {
    const displacedSessionId = targetPane.sessionId;
    root = updatePane(root, safeTargetPaneId, (pane) => ({
      ...pane,
      sessionId,
    }));

    if (displacedSessionId) {
      const emptyPane = collectPanes(root).find(
        (pane) => pane.id !== safeTargetPaneId && !pane.sessionId,
      );

      if (emptyPane) {
        root = updatePane(root, emptyPane.id, (pane) => ({
          ...pane,
          sessionId: displacedSessionId,
        }));
      }
    }
  }

  return {
    ...layout,
    root,
    activePaneId: safeTargetPaneId,
  };
}

function getFlowForDropZone(
  zone: Exclude<TerminalPaneDropZone, "center">,
): TerminalSplitFlow {
  return zone === "left" || zone === "right" ? "row" : "column";
}

function splitPaneInLayout(
  layout: TerminalProjectLayout,
  targetPaneId: string,
  zone: Exclude<TerminalPaneDropZone, "center">,
  sessionId: string,
): TerminalProjectLayout {
  const targetPane = findPaneById(layout.root, targetPaneId);
  if (!targetPane) {
    return layout;
  }

  const sourcePane = findPaneBySession(layout.root, sessionId);
  if (sourcePane?.id === targetPaneId) {
    return {
      ...layout,
      activePaneId: targetPaneId,
    };
  }

  let root = layout.root;
  let insertedPane: TerminalPaneLayoutNode;

  if (sourcePane) {
    root = removePane(root, sourcePane.id) ?? createPane(null);
    insertedPane = sourcePane;
  } else {
    if (countPanes(root) >= MAX_GRID_PANES) {
      return placeSessionInLayout(layout, sessionId, targetPaneId);
    }

    insertedPane = createPane(sessionId);
  }

  const liveTargetPane = findPaneById(root, targetPaneId);
  if (!liveTargetPane) {
    return placeSessionInLayout(
      {
        ...layout,
        root,
      },
      sessionId,
    );
  }

  const split = zone === "left" || zone === "top"
    ? createSplit(getFlowForDropZone(zone), insertedPane, liveTargetPane)
    : createSplit(getFlowForDropZone(zone), liveTargetPane, insertedPane);

  return {
    mode: "grid",
    root: replacePane(root, targetPaneId, split),
    activePaneId: insertedPane.id,
  };
}

function normalizeLayout(
  layout: TerminalProjectLayout | undefined,
  validSessionIds: string[],
  preferredSessionId?: string | null,
): TerminalProjectLayout {
  const validSet = new Set(validSessionIds);
  let root = layout?.root
    ? sanitizeNode(layout.root, validSet, new Set<string>())
    : createPane(null);
  let panes = collectPanes(root);

  if (panes.length === 0) {
    root = createPane(null);
    panes = collectPanes(root);
  }

  const activePaneId =
    layout?.activePaneId && panes.some((pane) => pane.id === layout.activePaneId)
      ? layout.activePaneId
      : panes[0].id;

  let nextLayout: TerminalProjectLayout = {
    mode: layout?.mode ?? "grid",
    root,
    activePaneId,
  };

  if (
    preferredSessionId &&
    validSet.has(preferredSessionId) &&
    !findPaneBySession(nextLayout.root, preferredSessionId)
  ) {
    nextLayout = placeSessionInLayout(nextLayout, preferredSessionId, nextLayout.activePaneId);
  }

  if (validSessionIds.length > 0 && !hasAssignedSession(nextLayout.root)) {
    const fallbackSessionId =
      preferredSessionId && validSet.has(preferredSessionId)
        ? preferredSessionId
        : validSessionIds[0];
    nextLayout = placeSessionInLayout(nextLayout, fallbackSessionId, nextLayout.activePaneId);
  }

  return nextLayout;
}

function reorderScopedSessions(
  sessions: AgentSession[],
  draggedId: string,
  targetId: string,
  projectId?: string,
): AgentSession[] {
  if (draggedId === targetId) return sessions;

  if (!projectId) {
    const nextSessions = [...sessions];
    const draggedIndex = nextSessions.findIndex((session) => session.id === draggedId);
    const targetIndex = nextSessions.findIndex((session) => session.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return sessions;
    }

    const [draggedSession] = nextSessions.splice(draggedIndex, 1);
    const insertionIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextSessions.splice(insertionIndex, 0, draggedSession);
    return nextSessions;
  }

  const scopedSessions = sessions.filter((session) => session.projectId === projectId);
  const draggedScopedIndex = scopedSessions.findIndex((session) => session.id === draggedId);
  const targetScopedIndex = scopedSessions.findIndex((session) => session.id === targetId);

  if (draggedScopedIndex === -1 || targetScopedIndex === -1) {
    return sessions;
  }

  const nextScopedSessions = [...scopedSessions];
  const [draggedSession] = nextScopedSessions.splice(draggedScopedIndex, 1);
  const insertionIndex =
    draggedScopedIndex < targetScopedIndex ? targetScopedIndex - 1 : targetScopedIndex;
  nextScopedSessions.splice(insertionIndex, 0, draggedSession);

  let scopedIndex = 0;
  return sessions.map((session) =>
    session.projectId === projectId ? nextScopedSessions[scopedIndex++] : session,
  );
}


interface SessionState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  globalLayout: TerminalProjectLayout;
  addSession: (session: AgentSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setLayoutMode: (projectId: string, mode: TerminalLayoutMode) => void;
  setPaneSession: (projectId: string, paneId: string, sessionId: string | null) => void;
  focusPane: (projectId: string, paneId: string) => void;
  setSplitRatio: (projectId: string, splitId: string, ratio: number) => void;
  splitPane: (
    projectId: string,
    paneId: string,
    zone: Exclude<TerminalPaneDropZone, "center">,
    sessionId: string,
  ) => void;
  reorderSessions: (draggedId: string, targetId: string, projectId?: string) => void;
  updateSessionStatus: (id: string, status: AgentStatus) => void;
  updateSessionYolo: (id: string, yoloMode: boolean) => void;
  persistSessions: () => void;
  loadPersistedSessions: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  globalLayout: createLayout(null),

  addSession: (session: AgentSession) => {
    set((state) => {
      const sessions = [...state.sessions, session];
      const allSessionIds = sessions.map((s) => s.id);
      const currentLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );

      let layout = placeSessionInLayout(currentLayout, session.id);

      // Auto-create artifacts pane for arbiter sessions
      if (session.arbiterEnabled) {
        const terminalPaneId = layout.activePaneId;
        const artifactsPane: TerminalPaneLayoutNode = {
          type: "pane",
          id: createNodeId("pane"),
          sessionId: null,
          paneType: "artifacts",
        };
        const terminalPane = findPaneById(layout.root, terminalPaneId);
        if (terminalPane) {
          const split = createSplit("row", terminalPane, artifactsPane, 0.7);
          layout = {
            ...layout,
            root: replacePane(layout.root, terminalPaneId, split),
          };
        }
      }

      return {
        sessions,
        activeSessionId: session.id,
        globalLayout: layout,
      };
    });
    get().persistSessions();
  },

  removeSession: (id: string) => {
    set((state) => {
      const removedSession = state.sessions.find((session) => session.id === id);
      const sessions = state.sessions.filter((session) => session.id !== id);
      const allSessionIds = sessions.map((s) => s.id);

      const activeSessionId =
        state.activeSessionId === id
          ? sessions[sessions.length - 1]?.id ?? null
          : state.activeSessionId;

      // Clean up artifacts panes when an arbiter session is removed
      let layoutToNormalize = state.globalLayout;
      if (removedSession?.arbiterEnabled) {
        const cleaned = removeArtifactsPanes(layoutToNormalize.root);
        if (cleaned) {
          layoutToNormalize = { ...layoutToNormalize, root: cleaned };
        }
      }

      let globalLayout = normalizeLayout(layoutToNormalize, allSessionIds);

      if (activeSessionId) {
        const activePane = findPaneBySession(globalLayout.root, activeSessionId);
        globalLayout = {
          ...globalLayout,
          activePaneId: activePane?.id ?? globalLayout.activePaneId,
        };
      }

      return { sessions, activeSessionId, globalLayout };
    });
    get().persistSessions();
  },

  setActiveSession: (id: string | null) => {
    set((state) => {
      if (!id) {
        return { activeSessionId: null };
      }

      const session = state.sessions.find((candidate) => candidate.id === id);
      if (!session) {
        return { activeSessionId: id };
      }

      const allSessionIds = state.sessions.map((s) => s.id);
      const currentLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );
      const existingPane = findPaneBySession(currentLayout.root, id);
      const nextLayout = existingPane
        ? {
            ...currentLayout,
            activePaneId: existingPane.id,
          }
        : placeSessionInLayout(currentLayout, id);

      return {
        activeSessionId: id,
        globalLayout: nextLayout,
      };
    });
  },

  setLayoutMode: (_projectId: string, mode: TerminalLayoutMode) => {
    set((state) => {
      const allSessionIds = state.sessions.map((s) => s.id);
      const currentLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );
      const activePane = findPaneById(currentLayout.root, currentLayout.activePaneId);

      return {
        activeSessionId:
          activePane?.sessionId && allSessionIds.includes(activePane.sessionId)
            ? activePane.sessionId
            : state.activeSessionId,
        globalLayout: {
          ...currentLayout,
          mode,
        },
      };
    });
  },

  setPaneSession: (_projectId: string, paneId: string, sessionId: string | null) => {
    set((state) => {
      const allSessionIds = state.sessions.map((s) => s.id);
      const baseLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );

      if (!findPaneById(baseLayout.root, paneId)) {
        return state;
      }

      if (sessionId) {
        if (!allSessionIds.includes(sessionId)) {
          return state;
        }

        const nextLayout = placeSessionInLayout(baseLayout, sessionId, paneId);
        return {
          activeSessionId: sessionId,
          globalLayout: nextLayout,
        };
      }

      // Remove the empty pane from the layout if there are other panes
      const panes = collectPanes(baseLayout.root);
      if (panes.length > 1) {
        const root = removePane(baseLayout.root, paneId) ?? createPane(null);
        const remainingPanes = collectPanes(root);
        const nextActivePaneId = remainingPanes[0]?.id ?? baseLayout.activePaneId;
        const nextActiveSessionId = remainingPanes[0]?.sessionId ?? state.activeSessionId;

        return {
          activeSessionId: nextActiveSessionId,
          globalLayout: {
            ...baseLayout,
            root,
            activePaneId: nextActivePaneId,
          },
        };
      }

      const root = updatePane(baseLayout.root, paneId, (pane) => ({
        ...pane,
        sessionId: null,
      }));

      return {
        globalLayout: {
          ...baseLayout,
          root,
          activePaneId: paneId,
        },
      };
    });
  },

  focusPane: (_projectId: string, paneId: string) => {
    set((state) => {
      const allSessionIds = state.sessions.map((s) => s.id);
      const currentLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );
      const panes = collectPanes(currentLayout.root);
      const safePaneId = panes.some((pane) => pane.id === paneId) ? paneId : panes[0]?.id;

      if (!safePaneId) {
        return state;
      }

      const paneSessionId = findPaneById(currentLayout.root, safePaneId)?.sessionId;

      return {
        activeSessionId: paneSessionId ?? state.activeSessionId,
        globalLayout: {
          ...currentLayout,
          activePaneId: safePaneId,
        },
      };
    });
  },

  setSplitRatio: (_projectId: string, splitId: string, ratio: number) => {
    set((state) => {
      return {
        globalLayout: {
          ...state.globalLayout,
          root: updateSplitNode(state.globalLayout.root, splitId, (split) => ({
            ...split,
            ratio: clampRatio(ratio),
          })),
        },
      };
    });
  },

  splitPane: (
    _projectId: string,
    paneId: string,
    zone: Exclude<TerminalPaneDropZone, "center">,
    sessionId: string,
  ) => {
    set((state) => {
      // Accept any session that exists in the global sessions list
      if (!state.sessions.some((s) => s.id === sessionId)) {
        return state;
      }

      const allSessionIds = state.sessions.map((s) => s.id);
      const currentLayout = normalizeLayout(
        state.globalLayout,
        allSessionIds,
        state.activeSessionId,
      );
      const nextLayout = splitPaneInLayout(currentLayout, paneId, zone, sessionId);

      return {
        activeSessionId: sessionId,
        globalLayout: {
          ...nextLayout,
          mode: "grid",
        },
      };
    });
  },

  reorderSessions: (draggedId: string, targetId: string, projectId?: string) => {
    set((state) => ({
      sessions: reorderScopedSessions(state.sessions, draggedId, targetId, projectId),
    }));
    get().persistSessions();
  },

  updateSessionStatus: (id: string, status: AgentStatus) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === id);
      if (!session || session.status === status) return state;
      return {
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, status } : s,
        ),
      };
    });
  },

  updateSessionYolo: (id: string, yoloMode: boolean) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, yoloMode } : session,
      ),
    }));
  },

  persistSessions: () => {
    const { sessions } = get();
    const persisted: PersistedSession[] = sessions
      .filter((session) => session.status !== "error" && session.status !== "finished")
      .map((session) => ({
        id: session.id,
        project_id: session.projectId,
        agent_type: session.agentType,
        yolo_mode: session.yoloMode,
        label: session.label,
        created_at: session.createdAt,
      }));

    saveSessions(persisted).catch((err) => {
      console.error("Failed to persist sessions:", err);
    });
  },

  loadPersistedSessions: async () => {
    try {
      const persisted = await loadSessions();
      if (persisted.length === 0) return;

      const { sessions: existingSessions } = get();
      const existingIds = new Set(existingSessions.map((session) => session.id));

      const resumed: AgentSession[] = persisted
        .filter((session) => !existingIds.has(session.id))
        .map((session) => ({
          id: session.id,
          projectId: session.project_id,
          agentType: session.agent_type,
          status: "starting" as const,
          yoloMode: session.yolo_mode,
          createdAt: session.created_at,
          label: session.label,
          isResumed: true,
        }));

      if (resumed.length === 0) return;

      set((state) => {
        const sessions = [...state.sessions, ...resumed];
        const allSessionIds = sessions.map((s) => s.id);

        let globalLayout = normalizeLayout(state.globalLayout, allSessionIds);

        for (const resumedSession of resumed) {
          globalLayout = placeSessionInLayout(globalLayout, resumedSession.id);
        }

        return {
          sessions,
          activeSessionId: resumed[resumed.length - 1]?.id ?? state.activeSessionId,
          globalLayout,
        };
      });
    } catch (err) {
      console.error("Failed to load persisted sessions:", err);
      useNotificationStore.getState().showToast("error", "Failed to load persisted sessions", String(err));
    }
  },
}));

// ---------------------------------------------------------------------------
// Migration helper: used by the Zustand persist middleware or manual hydration
// to upgrade persisted state that still uses the old `projectLayouts` shape.
// ---------------------------------------------------------------------------
export function migratePersistedState(
  persistedState: Record<string, unknown>,
): Partial<SessionState> {
  // If the persisted state already has a globalLayout, nothing to do.
  if (persistedState.globalLayout) {
    return persistedState as Partial<SessionState>;
  }

  // Migrate from projectLayouts -> globalLayout by merging all project
  // layouts into a single layout. We simply start from an empty layout and
  // place every session that we find in any project layout.
  const projectLayouts = persistedState.projectLayouts as
    | Record<string, TerminalProjectLayout>
    | undefined;

  if (!projectLayouts || Object.keys(projectLayouts).length === 0) {
    return {
      ...persistedState,
      globalLayout: createLayout(null),
    } as Partial<SessionState>;
  }

  // Collect all session IDs that were placed in any project layout, preserving
  // order (iterate project layouts in insertion order).
  const placedSessionIds: string[] = [];
  const usedIds = new Set<string>();

  for (const layout of Object.values(projectLayouts)) {
    const panes = collectPanes(layout.root);
    for (const pane of panes) {
      if (pane.sessionId && !usedIds.has(pane.sessionId)) {
        placedSessionIds.push(pane.sessionId);
        usedIds.add(pane.sessionId);
      }
    }
  }

  let globalLayout = createLayout(null);
  for (const sessionId of placedSessionIds) {
    globalLayout = placeSessionInLayout(globalLayout, sessionId);
  }

  const migrated = { ...persistedState } as Record<string, unknown>;
  migrated.globalLayout = globalLayout;
  delete migrated.projectLayouts;

  return migrated as Partial<SessionState>;
}
