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

function collectPanes(
  node: TerminalLayoutNode,
  panes: TerminalPaneLayoutNode[] = [],
): TerminalPaneLayoutNode[] {
  if (node.type === "pane") {
    panes.push(node);
    return panes;
  }

  collectPanes(node.first, panes);
  collectPanes(node.second, panes);
  return panes;
}

function countPanes(node: TerminalLayoutNode): number {
  return node.type === "pane" ? 1 : countPanes(node.first) + countPanes(node.second);
}

function findPaneById(node: TerminalLayoutNode, paneId: string): TerminalPaneLayoutNode | null {
  if (node.type === "pane") {
    return node.id === paneId ? node : null;
  }

  return findPaneById(node.first, paneId) ?? findPaneById(node.second, paneId);
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

function getProjectSessionIds(sessions: AgentSession[], projectId: string): string[] {
  return sessions
    .filter((session) => session.projectId === projectId)
    .map((session) => session.id);
}

interface SessionState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  projectLayouts: Record<string, TerminalProjectLayout>;
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
  projectLayouts: {},

  addSession: (session: AgentSession) => {
    set((state) => {
      const sessions = [...state.sessions, session];
      const projectSessionIds = getProjectSessionIds(sessions, session.projectId);
      const currentLayout = normalizeLayout(
        state.projectLayouts[session.projectId] ?? createLayout(null),
        projectSessionIds,
        state.activeSessionId,
      );

      return {
        sessions,
        activeSessionId: session.id,
        projectLayouts: {
          ...state.projectLayouts,
          [session.projectId]: placeSessionInLayout(currentLayout, session.id),
        },
      };
    });
    get().persistSessions();
  },

  removeSession: (id: string) => {
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id);
      const projectLayouts: Record<string, TerminalProjectLayout> = {};

      for (const [projectId, layout] of Object.entries(state.projectLayouts)) {
        projectLayouts[projectId] = normalizeLayout(
          layout,
          getProjectSessionIds(sessions, projectId),
        );
      }

      const activeSessionId =
        state.activeSessionId === id
          ? sessions[sessions.length - 1]?.id ?? null
          : state.activeSessionId;

      if (activeSessionId) {
        const activeSession = sessions.find((session) => session.id === activeSessionId);
        if (activeSession) {
          const projectSessionIds = getProjectSessionIds(sessions, activeSession.projectId);
          const nextLayout = normalizeLayout(
            projectLayouts[activeSession.projectId] ?? createLayout(null),
            projectSessionIds,
            activeSessionId,
          );
          const activePane = findPaneBySession(nextLayout.root, activeSessionId);
          projectLayouts[activeSession.projectId] = {
            ...nextLayout,
            activePaneId: activePane?.id ?? nextLayout.activePaneId,
          };
        }
      }

      return { sessions, activeSessionId, projectLayouts };
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

      const projectSessionIds = getProjectSessionIds(state.sessions, session.projectId);
      const currentLayout = normalizeLayout(
        state.projectLayouts[session.projectId] ?? createLayout(null),
        projectSessionIds,
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
        projectLayouts: {
          ...state.projectLayouts,
          [session.projectId]: nextLayout,
        },
      };
    });
  },

  setLayoutMode: (projectId: string, mode: TerminalLayoutMode) => {
    set((state) => {
      const projectSessionIds = getProjectSessionIds(state.sessions, projectId);
      const currentLayout = normalizeLayout(
        state.projectLayouts[projectId] ?? createLayout(null),
        projectSessionIds,
        state.activeSessionId,
      );
      const activePane = findPaneById(currentLayout.root, currentLayout.activePaneId);

      return {
        activeSessionId:
          activePane?.sessionId && projectSessionIds.includes(activePane.sessionId)
            ? activePane.sessionId
            : state.activeSessionId,
        projectLayouts: {
          ...state.projectLayouts,
          [projectId]: {
            ...currentLayout,
            mode,
          },
        },
      };
    });
  },

  setPaneSession: (projectId: string, paneId: string, sessionId: string | null) => {
    set((state) => {
      const projectSessionIds = getProjectSessionIds(state.sessions, projectId);
      const baseLayout = normalizeLayout(
        state.projectLayouts[projectId] ?? createLayout(null),
        projectSessionIds,
        state.activeSessionId,
      );

      if (!findPaneById(baseLayout.root, paneId)) {
        return state;
      }

      if (sessionId) {
        if (!projectSessionIds.includes(sessionId)) {
          return state;
        }

        const nextLayout = placeSessionInLayout(baseLayout, sessionId, paneId);
        return {
          activeSessionId: sessionId,
          projectLayouts: {
            ...state.projectLayouts,
            [projectId]: nextLayout,
          },
        };
      }

      const root = updatePane(baseLayout.root, paneId, (pane) => ({
        ...pane,
        sessionId: null,
      }));

      return {
        projectLayouts: {
          ...state.projectLayouts,
          [projectId]: {
            ...baseLayout,
            root,
            activePaneId: paneId,
          },
        },
      };
    });
  },

  focusPane: (projectId: string, paneId: string) => {
    set((state) => {
      const projectSessionIds = getProjectSessionIds(state.sessions, projectId);
      const currentLayout = normalizeLayout(
        state.projectLayouts[projectId] ?? createLayout(null),
        projectSessionIds,
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
        projectLayouts: {
          ...state.projectLayouts,
          [projectId]: {
            ...currentLayout,
            activePaneId: safePaneId,
          },
        },
      };
    });
  },

  setSplitRatio: (projectId: string, splitId: string, ratio: number) => {
    set((state) => {
      const currentLayout = state.projectLayouts[projectId];
      if (!currentLayout) return state;

      return {
        projectLayouts: {
          ...state.projectLayouts,
          [projectId]: {
            ...currentLayout,
            root: updateSplitNode(currentLayout.root, splitId, (split) => ({
              ...split,
              ratio: clampRatio(ratio),
            })),
          },
        },
      };
    });
  },

  splitPane: (
    projectId: string,
    paneId: string,
    zone: Exclude<TerminalPaneDropZone, "center">,
    sessionId: string,
  ) => {
    set((state) => {
      const projectSessionIds = getProjectSessionIds(state.sessions, projectId);

      if (!projectSessionIds.includes(sessionId)) {
        return state;
      }

      const currentLayout = normalizeLayout(
        state.projectLayouts[projectId] ?? createLayout(null),
        projectSessionIds,
        state.activeSessionId,
      );
      const nextLayout = splitPaneInLayout(currentLayout, paneId, zone, sessionId);

      return {
        activeSessionId: sessionId,
        projectLayouts: {
          ...state.projectLayouts,
          [projectId]: {
            ...nextLayout,
            mode: "grid",
          },
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
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, status } : session,
      ),
    }));
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
        const nextProjectLayouts = { ...state.projectLayouts };

        for (const resumedSession of resumed) {
          const projectSessionIds = getProjectSessionIds(sessions, resumedSession.projectId);
          const currentLayout = normalizeLayout(
            nextProjectLayouts[resumedSession.projectId] ?? createLayout(null),
            projectSessionIds,
          );
          nextProjectLayouts[resumedSession.projectId] = placeSessionInLayout(
            currentLayout,
            resumedSession.id,
          );
        }

        return {
          sessions,
          activeSessionId: resumed[resumed.length - 1]?.id ?? state.activeSessionId,
          projectLayouts: nextProjectLayouts,
        };
      });
    } catch (err) {
      console.error("Failed to load persisted sessions:", err);
      useNotificationStore.getState().showToast("error", "Failed to load persisted sessions", String(err));
    }
  },
}));
