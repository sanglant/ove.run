import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from "react";
import { GripVertical, Terminal } from "lucide-react";
import { Stack, Text, Button } from "@mantine/core";
import cn from "clsx";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalPanel } from "./TerminalPanel";
import { ArtifactsPane } from "./ArtifactsPane";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import type {
  TerminalLayoutNode,
  TerminalPaneDropZone,
  TerminalPaneLayoutNode,
  TerminalProjectLayout,
  TerminalSplitFlow,
} from "@/types";
import classes from "./TerminalContainer.module.css";

const SESSION_DRAG_MIME = "application/x-ove-run-session";
const MAX_GRID_PANES = 8;
const DROP_EDGE_THRESHOLD = 0.28;
const MIN_PANE_WIDTH = 180;
const MIN_PANE_HEIGHT = 120;

interface LayoutRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RenderedPane {
  paneId: string;
  sessionId: string | null;
  paneType: "terminal" | "artifacts" | undefined;
  rect: LayoutRect;
}

interface RenderedHandle {
  splitId: string;
  flow: TerminalSplitFlow;
  bounds: LayoutRect;
  ratio: number;
  firstUnits: number;
  secondUnits: number;
}

interface PaneDragState {
  paneId: string | null;
  zone: TerminalPaneDropZone | null;
  sessionId: string | null;
}

function createFallbackLayout(
  projectSessionIds: string[],
  preferredSessionId?: string | null,
): TerminalProjectLayout {
  const root: TerminalPaneLayoutNode = {
    type: "pane",
    id: "pane-fallback",
    sessionId:
      preferredSessionId && projectSessionIds.includes(preferredSessionId)
        ? preferredSessionId
        : projectSessionIds[0] ?? null,
  };

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

function getPaneMinUnits(node: TerminalLayoutNode, flow: TerminalSplitFlow): number {
  if (node.type === "pane") {
    return 1;
  }

  if (node.flow === flow) {
    return getPaneMinUnits(node.first, flow) + getPaneMinUnits(node.second, flow);
  }

  return Math.max(getPaneMinUnits(node.first, flow), getPaneMinUnits(node.second, flow));
}

function buildGridRenderData(
  node: TerminalLayoutNode,
  bounds: LayoutRect,
  panes: RenderedPane[],
  handles: RenderedHandle[],
) {
  if (node.type === "pane") {
    panes.push({
      paneId: node.id,
      sessionId: node.sessionId,
      paneType: node.paneType,
      rect: bounds,
    });
    return;
  }

  handles.push({
    splitId: node.id,
    flow: node.flow,
    bounds,
    ratio: node.ratio,
    firstUnits: getPaneMinUnits(node.first, node.flow),
    secondUnits: getPaneMinUnits(node.second, node.flow),
  });

  if (node.flow === "row") {
    const firstWidth = bounds.width * node.ratio;
    const secondWidth = bounds.width - firstWidth;

    buildGridRenderData(
      node.first,
      {
        top: bounds.top,
        left: bounds.left,
        width: firstWidth,
        height: bounds.height,
      },
      panes,
      handles,
    );
    buildGridRenderData(
      node.second,
      {
        top: bounds.top,
        left: bounds.left + firstWidth,
        width: secondWidth,
        height: bounds.height,
      },
      panes,
      handles,
    );
    return;
  }

  const firstHeight = bounds.height * node.ratio;
  const secondHeight = bounds.height - firstHeight;

  buildGridRenderData(
    node.first,
    {
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: firstHeight,
    },
    panes,
    handles,
  );
  buildGridRenderData(
    node.second,
    {
      top: bounds.top + firstHeight,
      left: bounds.left,
      width: bounds.width,
      height: secondHeight,
    },
    panes,
    handles,
  );
}

function buildRenderData(layout: TerminalProjectLayout): {
  panes: RenderedPane[];
  handles: RenderedHandle[];
} {
  if (layout.mode === "single") {
    const activePane = findPaneById(layout.root, layout.activePaneId) ?? collectPanes(layout.root)[0];

    return {
      panes: activePane
        ? [
            {
              paneId: activePane.id,
              sessionId: activePane.sessionId,
              paneType: activePane.paneType,
              rect: { top: 0, left: 0, width: 1, height: 1 },
            },
          ]
        : [],
      handles: [],
    };
  }

  const panes: RenderedPane[] = [];
  const handles: RenderedHandle[] = [];
  buildGridRenderData(layout.root, { top: 0, left: 0, width: 1, height: 1 }, panes, handles);
  return { panes, handles };
}

function paneRectToStyle(rect: LayoutRect): CSSProperties {
  return {
    top: `${rect.top * 100}%`,
    left: `${rect.left * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function resizeHandleToStyle(handle: RenderedHandle): CSSProperties {
  if (handle.flow === "row") {
    return {
      top: `${handle.bounds.top * 100}%`,
      left: `${(handle.bounds.left + handle.bounds.width * handle.ratio) * 100}%`,
      height: `${handle.bounds.height * 100}%`,
    };
  }

  return {
    top: `${(handle.bounds.top + handle.bounds.height * handle.ratio) * 100}%`,
    left: `${handle.bounds.left * 100}%`,
    width: `${handle.bounds.width * 100}%`,
  };
}

function isSessionDrag(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes(SESSION_DRAG_MIME) || types.includes("text/plain");
}

function readDraggedSessionId(dataTransfer: DataTransfer): string {
  return dataTransfer.getData(SESSION_DRAG_MIME) || dataTransfer.getData("text/plain");
}

function getPaneDropZone(
  event: DragEvent<HTMLElement>,
  canSplit: boolean,
): TerminalPaneDropZone {
  if (!canSplit) {
    return "center";
  }

  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return "center";
  }

  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const nearestEdge = (
    [
      ["top", y],
      ["left", x],
      ["right", 1 - x],
      ["bottom", 1 - y],
    ] as Array<[Exclude<TerminalPaneDropZone, "center">, number]>
  ).sort(([, firstDistance], [, secondDistance]) => firstDistance - secondDistance)[0];

  return nearestEdge[1] <= DROP_EDGE_THRESHOLD ? nearestEdge[0] : "center";
}

function getDropOverlayLabel(
  zone: TerminalPaneDropZone,
  splitEnabled: boolean,
  hasSession: boolean,
): string {
  if (zone === "center") {
    if (!hasSession) return "Drop here";
    return splitEnabled ? "Replace pane" : "Move here";
  }

  return `Split ${zone}`;
}

export function TerminalContainer() {
  const {
    sessions,
    activeSessionId,
    globalLayout,
    focusPane,
    setPaneSession,
    setSplitRatio,
    splitPane,
  } = useSessionStore();
  const { activeProjectId, projects } = useProjectStore();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [paneDragState, setPaneDragState] = useState<PaneDragState>({
    paneId: null,
    zone: null,
    sessionId: null,
  });
  const [activeResizeSplitId, setActiveResizeSplitId] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const projectSessions = sessions.filter((session) => session.projectId === activeProjectId);
  const projectPathMap = new Map(projects.map((project) => [project.id, project.path]));
  const sessionMap = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);

  const layout = useMemo(() => {
    const allSessionIds = sessions.map((s) => s.id);
    if (allSessionIds.length === 0) {
      return createFallbackLayout([]);
    }

    return globalLayout ?? createFallbackLayout(allSessionIds, activeSessionId);
  }, [activeSessionId, globalLayout, sessions]);

  const renderedLayout = useMemo(() => buildRenderData(layout), [layout]);
  const paneCount = useMemo(() => countPanes(layout.root), [layout.root]);
  const paneAssignments = useMemo(() => collectPanes(layout.root), [layout.root]);
  const visiblePaneBySessionId = useMemo(() => {
    const map = new Map<string, RenderedPane>();
    renderedLayout.panes.forEach((pane) => {
      if (pane.sessionId) {
        map.set(pane.sessionId, pane);
      }
    });
    return map;
  }, [renderedLayout.panes]);

  const clearPaneDragState = useCallback(() => {
    setPaneDragState((state) =>
      state.paneId || state.zone || state.sessionId
        ? { paneId: null, zone: null, sessionId: null }
        : state,
    );
  }, []);

  const canSplitPane = useCallback(
    (paneId: string, draggedSessionId?: string) => {
      if (paneCount < MAX_GRID_PANES) {
        return true;
      }

      if (!draggedSessionId) {
        return false;
      }

      const sourcePane = paneAssignments.find((pane) => pane.sessionId === draggedSessionId);
      return Boolean(sourcePane && sourcePane.id !== paneId);
    },
    [paneAssignments, paneCount],
  );

  useEffect(() => {
    const clear = () => clearPaneDragState();
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);

    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [clearPaneDragState]);

  const handlePaneFocus = useCallback(
    (paneId: string) => {
      focusPane(activeProjectId ?? "", paneId);
    },
    [activeProjectId, focusPane],
  );

  const handlePaneHandleDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(SESSION_DRAG_MIME, sessionId);
      event.dataTransfer.setData("text/plain", sessionId);
      clearPaneDragState();
    },
    [clearPaneDragState],
  );

  const handlePaneDragOver = useCallback(
    (event: DragEvent<HTMLElement>, paneId: string) => {
      if (!isSessionDrag(event)) {
        return;
      }

      const draggedSessionId = readDraggedSessionId(event.dataTransfer);

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const splitEnabled = canSplitPane(paneId, draggedSessionId || undefined);
      const zone = getPaneDropZone(event, splitEnabled);
      setPaneDragState((state) =>
        state.paneId === paneId &&
        state.zone === zone &&
        state.sessionId === (draggedSessionId || null)
          ? state
          : { paneId, zone, sessionId: draggedSessionId || null },
      );
    },
    [canSplitPane],
  );

  const handlePaneDrop = useCallback(
    (event: DragEvent<HTMLElement>, paneId: string) => {
      event.preventDefault();

      const sessionId = readDraggedSessionId(event.dataTransfer);
      const session = sessionMap.get(sessionId);

      if (!session) {
        clearPaneDragState();
        return;
      }

      const splitEnabled = canSplitPane(paneId, sessionId);
      const zone = getPaneDropZone(event, splitEnabled);
      if (zone !== "center" && splitEnabled) {
        splitPane(session.projectId, paneId, zone, sessionId);
      } else {
        setPaneSession(session.projectId, paneId, sessionId);
      }

      clearPaneDragState();
    },
    [canSplitPane, clearPaneDragState, sessionMap, setPaneSession, splitPane],
  );

  const handlePaneDragLeave = useCallback(
    (event: DragEvent<HTMLElement>, paneId: string) => {
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
        return;
      }

      setPaneDragState((state) =>
        state.paneId === paneId ? { paneId: null, zone: null, sessionId: null } : state,
      );
    },
    [],
  );

  const handleResizeStart = useCallback(
    (handle: RenderedHandle, event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveResizeSplitId(handle.splitId);

      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const workspace = workspaceRef.current;
        if (!workspace) return;

        const rect = workspace.getBoundingClientRect();
        const splitLeft = rect.width * handle.bounds.left;
        const splitTop = rect.height * handle.bounds.top;
        const splitWidth = rect.width * handle.bounds.width;
        const splitHeight = rect.height * handle.bounds.height;
        const totalSize = handle.flow === "row" ? splitWidth : splitHeight;
        if (totalSize <= 0) return;

        const pointerOffset =
          handle.flow === "row"
            ? moveEvent.clientX - rect.left - splitLeft
            : moveEvent.clientY - rect.top - splitTop;
        const minPaneSize = handle.flow === "row" ? MIN_PANE_WIDTH : MIN_PANE_HEIGHT;
        let minFirstRatio = (handle.firstUnits * minPaneSize) / totalSize;
        let minSecondRatio = (handle.secondUnits * minPaneSize) / totalSize;

        if (minFirstRatio + minSecondRatio > 0.92) {
          const scale = 0.92 / (minFirstRatio + minSecondRatio);
          minFirstRatio *= scale;
          minSecondRatio *= scale;
        }

        const nextRatio = Math.min(
          Math.max(pointerOffset / totalSize, minFirstRatio),
          1 - minSecondRatio,
        );
        setSplitRatio("", handle.splitId, nextRatio);
      };

      const onMouseUp = () => {
        setActiveResizeSplitId(null);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [setSplitRatio],
  );

  const isProjectEmpty = sessions.length === 0;

  return (
    <div className={classes.container}>
      <TerminalTabs
        sessions={projectSessions}
        allSessions={sessions}
        onNewSession={() => setShowNewDialog(true)}
      />

      <div className={classes.workspace} ref={workspaceRef}>
        <div className={classes.workspaceSurface}>
          {renderedLayout.panes.map((pane) => {
            const isFocused = pane.paneId === layout.activePaneId;
            const isArtifacts = pane.paneType === "artifacts";
            const isEmpty = !pane.sessionId && !isArtifacts;

            return (
              <div
                key={`surface-${pane.paneId}`}
                className={classes.paneSurface}
                style={paneRectToStyle(pane.rect)}
                data-focused={isFocused || undefined}
                data-empty={isEmpty || undefined}
                data-drag-over={paneDragState.paneId === pane.paneId || undefined}
                onClick={() => handlePaneFocus(pane.paneId)}
                onDragOver={(event) => handlePaneDragOver(event, pane.paneId)}
                onDrop={(event) => handlePaneDrop(event, pane.paneId)}
                onDragLeave={(event) => handlePaneDragLeave(event, pane.paneId)}
              >
                {isArtifacts ? (
                  <ArtifactsPane />
                ) : isEmpty ? (
                  <div className={classes.emptyPaneContent}>
                    <div className={classes.emptyPaneCard}>
                      <span className={classes.emptyPaneTitle}>Drop terminal here</span>
                      <span className={classes.emptyPaneHint}>
                        Drag a terminal tab into this pane to replace it, or toward an edge in grid mode to split.
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {sessions.map((session) => {
            const renderedPane = visiblePaneBySessionId.get(session.id);
            const isVisible = Boolean(renderedPane);
            const isFocused = isVisible && renderedPane?.paneId === layout.activePaneId;

            return (
              <div
                key={session.id}
                className={cn(classes.sessionSlot, !(isVisible && renderedPane) && classes.sessionSlotHidden)}
                style={renderedPane ? paneRectToStyle(renderedPane.rect) : undefined}
                data-focused={isFocused || undefined}
                onMouseDown={() => {
                  if (renderedPane) {
                    focusPane(activeProjectId ?? "", renderedPane.paneId);
                  }
                }}
                onDragOver={(event) => {
                  if (renderedPane) {
                    handlePaneDragOver(event, renderedPane.paneId);
                  }
                }}
                onDrop={(event) => {
                  if (renderedPane) {
                    handlePaneDrop(event, renderedPane.paneId);
                  }
                }}
                onDragLeave={(event) => {
                  if (renderedPane) {
                    handlePaneDragLeave(event, renderedPane.paneId);
                  }
                }}
              >
                <TerminalPanel
                  session={session}
                  isVisible={isVisible}
                  isFocused={Boolean(isFocused && session.id === activeSessionId)}
                  projectPath={projectPathMap.get(session.projectId) ?? ""}
                />
              </div>
            );
          })}

          {renderedLayout.panes.length > 1 &&
            renderedLayout.panes.map((pane) => {
              if (!pane.sessionId) {
                return null;
              }

              const session = sessionMap.get(pane.sessionId);
              if (!session) {
                return null;
              }

              return (
                <div
                  key={`chrome-${pane.paneId}`}
                  className={classes.paneChrome}
                  style={paneRectToStyle(pane.rect)}
                  data-focused={pane.paneId === layout.activePaneId || undefined}
                >
                  <button
                    type="button"
                    className={classes.paneHandle}
                    draggable
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePaneFocus(pane.paneId);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => handlePaneHandleDragStart(event, session.id)}
                    onDragOver={(event) => handlePaneDragOver(event, pane.paneId)}
                    onDrop={(event) => handlePaneDrop(event, pane.paneId)}
                    onDragLeave={(event) => handlePaneDragLeave(event, pane.paneId)}
                    onDragEnd={clearPaneDragState}
                    title={`Drag ${session.label} to move or split panes`}
                  >
                    <GripVertical size={12} />
                    <span className={classes.paneHandleLabel}>{session.label}</span>
                  </button>
                </div>
              );
            })}

          {renderedLayout.panes.map((pane) => {
            if (paneDragState.paneId !== pane.paneId) {
              return null;
            }

            const splitEnabled = canSplitPane(pane.paneId, paneDragState.sessionId ?? undefined);
            const activeZone = paneDragState.zone ?? "center";
            const overlayLabel = getDropOverlayLabel(
              activeZone,
              splitEnabled,
              Boolean(pane.sessionId),
            );

            return (
              <div
                key={`overlay-${pane.paneId}`}
                className={classes.dropOverlay}
                style={paneRectToStyle(pane.rect)}
                data-zone={activeZone}
                data-center-only={!splitEnabled || undefined}
              >
                <div className={classes.dropOverlayTint} />
                <div className={classes.dropHighlight} data-zone={activeZone} />
                <div className={classes.dropBadge}>{overlayLabel}</div>
              </div>
            );
          })}

          {renderedLayout.handles.map((handle) => (
              <div
                key={`resize-${handle.splitId}`}
                className={classes.resizeHandle}
                style={resizeHandleToStyle(handle)}
                data-active={activeResizeSplitId === handle.splitId || undefined}
                data-orientation={handle.flow === "row" ? "vertical" : "horizontal"}
                onMouseDown={(event) => handleResizeStart(handle, event)}
              />
            ))}
        </div>

        {isProjectEmpty && (
          <Stack
            align="center"
            justify="center"
            gap="md"
            className={cn(classes.emptyState, "animate-fade-in")}
          >
            <Terminal size={48} strokeWidth={1} />
            <div className={classes.emptyStateBody}>
              <Text size="lg" fw={500} c="var(--text-primary)">
                No active sessions
              </Text>
              <Text size="sm" mt={4}>
                {activeProjectId
                  ? "Start a new agent session or drag one into grid mode to split panes."
                  : "Select a project from the sidebar to get started"}
              </Text>
            </div>
            {activeProjectId && (
              <Button
                onClick={() => setShowNewDialog(true)}
                className={classes.newSessionButton}
              >
                New Agent Session
              </Button>
            )}
          </Stack>
        )}
      </div>

      {showNewDialog && (
        <NewAgentDialog
          projectId={activeProjectId ?? ""}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
