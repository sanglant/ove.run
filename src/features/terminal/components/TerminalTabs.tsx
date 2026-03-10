import { useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { X, Plus, Layers, List, Grid2x2 } from "lucide-react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { killPty } from "@/lib/tauri";
import type { AgentSession, TerminalLayoutMode } from "@/types";
import { v4 as uuidv4 } from "uuid";
import cn from "classnames";
import classes from "./TerminalTabs.module.css";

const SESSION_DRAG_MIME = "application/x-agentic-session";

interface TerminalTabsProps {
  sessions: AgentSession[];
  allSessions: AgentSession[];
  onNewSession: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; className?: string }> = {
  starting: { bg: "var(--warning)" },
  idle: { bg: "var(--text-secondary)" },
  working: { bg: "var(--accent)", className: "animate-pulse-glow" },
  needs_input: { bg: "var(--warning)", className: "animate-status-pulse" },
  finished: { bg: "var(--success)" },
  error: { bg: "var(--danger)" },
};

const AGENT_LABEL: Record<string, string> = {
  claude: "CC",
  gemini: "GC",
  copilot: "CP",
  codex: "CX",
  terminal: ">_",
};

const AGENT_COLOR: Record<string, string> = {
  claude: "var(--claude)",
  gemini: "var(--gemini)",
  copilot: "var(--copilot)",
  codex: "var(--codex)",
  terminal: "var(--text-secondary)",
};

const LAYOUT_OPTIONS: Array<{ mode: TerminalLayoutMode; label: string; icon: ReactNode }> = [
  {
    mode: "single",
    label: "Single pane",
    icon: <span className={classes.layoutIconLabel}>1</span>,
  },
  {
    mode: "grid",
    label: "Grid mode",
    icon: <Grid2x2 size={12} className={classes.layoutIcon} />,
  },
];

export function TerminalTabs({ sessions, allSessions, onNewSession }: TerminalTabsProps) {
  const {
    activeSessionId,
    projectLayouts,
    setActiveSession,
    setLayoutMode,
    reorderSessions,
    removeSession,
  } = useSessionStore();
  const { activeProjectId, projects, setActiveProject } = useProjectStore();
  const { setActivePanel, tabViewMode, setTabViewMode } = useUiStore();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dropSessionId, setDropSessionId] = useState<string | null>(null);

  const currentLayoutMode =
    activeProjectId && projectLayouts[activeProjectId]
      ? projectLayouts[activeProjectId].mode
      : "single";

  const handleTabClick = (session: AgentSession) => {
    setActiveProject(session.projectId);
    setActiveSession(session.id);
    setActivePanel("terminal");
  };

  const handleProjectTabClick = (projectId: string) => {
    setActiveProject(projectId);
    const firstSession = allSessions.find((session) => session.projectId === projectId);
    if (firstSession) {
      setActiveSession(firstSession.id);
    }
  };

  const closeSession = async (session: AgentSession) => {
    try {
      await killPty(session.id);
      removeSession(session.id);
    } catch (err) {
      const message = String(err);
      if (message.includes("not found")) {
        removeSession(session.id);
        return;
      }

      console.error("Failed to close terminal session:", err);
      addNotification({
        id: uuidv4(),
        title: "Session Close Failed",
        body: `${session.label}: ${message.slice(0, 200)}`,
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleClose = (event: MouseEvent, session: AgentSession) => {
    event.stopPropagation();
    void closeSession(session);
  };

  const handleKillActive = () => {
    const activeSession = allSessions.find((session) => session.id === activeSessionId);
    if (!activeSession) return;

    void closeSession(activeSession);
  };

  const handleLayoutChange = (mode: TerminalLayoutMode) => {
    if (!activeProjectId) return;
    setLayoutMode(activeProjectId, mode);
  };

  const handleTabDragStart = (event: DragEvent<HTMLElement>, sessionId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SESSION_DRAG_MIME, sessionId);
    event.dataTransfer.setData("text/plain", sessionId);
    setDraggedSessionId(sessionId);
    setDropSessionId(null);
  };

  const clearDragState = () => {
    setDraggedSessionId(null);
    setDropSessionId(null);
  };

  const getDraggedSession = (): AgentSession | undefined =>
    allSessions.find((session) => session.id === draggedSessionId);

  const canReorderInScope = (targetSession: AgentSession, scopeProjectId?: string): boolean => {
    const draggedSession = getDraggedSession();
    if (!draggedSession || draggedSession.id === targetSession.id) {
      return false;
    }

    if (!scopeProjectId) {
      return true;
    }

    return draggedSession.projectId === scopeProjectId && targetSession.projectId === scopeProjectId;
  };

  const handleTabDragOver = (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => {
    if (!canReorderInScope(targetSession, scopeProjectId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropSessionId(targetSession.id);
  };

  const handleTabDrop = (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => {
    event.preventDefault();

    const droppedSessionId =
      event.dataTransfer.getData(SESSION_DRAG_MIME) ||
      event.dataTransfer.getData("text/plain") ||
      draggedSessionId;

    if (!droppedSessionId || droppedSessionId === targetSession.id) {
      clearDragState();
      return;
    }

    reorderSessions(droppedSessionId, targetSession.id, scopeProjectId);
    clearDragState();
  };

  const viewToggle = (
    <Tooltip label={tabViewMode === "grouped" ? "Flat view" : "Grouped view"} withArrow>
      <ActionIcon
        variant="subtle"
        onClick={() => setTabViewMode(tabViewMode === "grouped" ? "flat" : "grouped")}
        aria-label="Toggle tab view mode"
        className={classes.actionIcon}
      >
        {tabViewMode === "grouped" ? <List size={12} /> : <Layers size={12} />}
      </ActionIcon>
    </Tooltip>
  );

  const layoutToggle = (
    <div className={classes.layoutToggle} role="group" aria-label="Terminal layout">
      {LAYOUT_OPTIONS.map((option) => (
        <Tooltip key={option.mode} label={option.label} withArrow>
          <ActionIcon
            variant="subtle"
            onClick={() => handleLayoutChange(option.mode)}
            aria-label={option.label}
            disabled={!activeProjectId}
            className={classes.actionIcon}
            data-active={currentLayoutMode === option.mode || undefined}
          >
            {option.icon}
          </ActionIcon>
        </Tooltip>
      ))}
    </div>
  );

  const newButton = (
    <ActionIcon
      variant="subtle"
      onClick={onNewSession}
      aria-label="New session"
      className={classes.actionIcon}
      data-separated
    >
      <Plus size={12} />
    </ActionIcon>
  );

  const killButton = activeSessionId ? (
    <Tooltip label="Kill active session" withArrow>
      <ActionIcon
        variant="subtle"
        onClick={handleKillActive}
        aria-label="Kill active session"
        className={classes.actionIcon}
        data-separated
      >
        <X size={12} />
      </ActionIcon>
    </Tooltip>
  ) : null;

  const actionCluster = (
    <div className={classes.actionCluster}>
      {viewToggle}
      {layoutToggle}
      {newButton}
      {killButton}
    </div>
  );

  return (
    <div className={classes.root}>
      {tabViewMode === "grouped" ? (
        <GroupedTabs
          sessions={sessions}
          allSessions={allSessions}
          activeSessionId={activeSessionId}
          activeProjectId={activeProjectId}
          projects={projects}
          draggedSessionId={draggedSessionId}
          dropSessionId={dropSessionId}
          actionCluster={actionCluster}
          onTabClick={handleTabClick}
          onClose={handleClose}
          onProjectClick={handleProjectTabClick}
          onTabDragStart={handleTabDragStart}
          onTabDragOver={handleTabDragOver}
          onTabDrop={handleTabDrop}
          onTabDragEnd={clearDragState}
        />
      ) : (
        <FlatTabs
          allSessions={allSessions}
          activeSessionId={activeSessionId}
          projects={projects}
          draggedSessionId={draggedSessionId}
          dropSessionId={dropSessionId}
          actionCluster={actionCluster}
          onTabClick={handleTabClick}
          onClose={handleClose}
          onTabDragStart={handleTabDragStart}
          onTabDragOver={handleTabDragOver}
          onTabDrop={handleTabDrop}
          onTabDragEnd={clearDragState}
        />
      )}
    </div>
  );
}

interface GroupedTabsProps {
  sessions: AgentSession[];
  allSessions: AgentSession[];
  activeSessionId: string | null;
  activeProjectId: string | null;
  projects: { id: string; name: string }[];
  draggedSessionId: string | null;
  dropSessionId: string | null;
  actionCluster: ReactNode;
  onTabClick: (session: AgentSession) => void;
  onClose: (event: MouseEvent, session: AgentSession) => void;
  onProjectClick: (projectId: string) => void;
  onTabDragStart: (event: DragEvent<HTMLElement>, sessionId: string) => void;
  onTabDragOver: (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => void;
  onTabDrop: (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => void;
  onTabDragEnd: () => void;
}

function GroupedTabs({
  sessions,
  allSessions,
  activeSessionId,
  activeProjectId,
  projects,
  draggedSessionId,
  dropSessionId,
  actionCluster,
  onTabClick,
  onClose,
  onProjectClick,
  onTabDragStart,
  onTabDragOver,
  onTabDrop,
  onTabDragEnd,
}: GroupedTabsProps) {
  const projectsWithSessions = projects.filter((project) =>
    allSessions.some((session) => session.projectId === project.id),
  );

  return (
    <>
      <div className={classes.projectRow}>
        <div className={classes.scrollArea} role="tablist" aria-label="Projects">
          {projectsWithSessions.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onProjectClick(project.id)}
                className={classes.projectTab}
                data-active={isActive || undefined}
              >
                <span className={classes.projectTabLabel}>{project.name}</span>
              </button>
            );
          })}
        </div>
        {actionCluster}
      </div>

      <div className={classes.sessionRow}>
        <div className={classes.scrollArea} role="tablist" aria-label="Sessions">
          {sessions.map((session) => (
            <SessionTab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              isDragged={session.id === draggedSessionId}
              isDropTarget={session.id === dropSessionId}
              compact
              onTabClick={onTabClick}
              onClose={onClose}
              onDragStart={onTabDragStart}
              onDragOver={(event) => onTabDragOver(event, session, activeProjectId ?? undefined)}
              onDrop={(event) => onTabDrop(event, session, activeProjectId ?? undefined)}
              onDragEnd={onTabDragEnd}
            />
          ))}
        </div>
      </div>
    </>
  );
}

interface FlatTabsProps {
  allSessions: AgentSession[];
  activeSessionId: string | null;
  projects: { id: string; name: string }[];
  draggedSessionId: string | null;
  dropSessionId: string | null;
  actionCluster: ReactNode;
  onTabClick: (session: AgentSession) => void;
  onClose: (event: MouseEvent, session: AgentSession) => void;
  onTabDragStart: (event: DragEvent<HTMLElement>, sessionId: string) => void;
  onTabDragOver: (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => void;
  onTabDrop: (
    event: DragEvent<HTMLElement>,
    targetSession: AgentSession,
    scopeProjectId?: string,
  ) => void;
  onTabDragEnd: () => void;
}

function FlatTabs({
  allSessions,
  activeSessionId,
  projects,
  draggedSessionId,
  dropSessionId,
  actionCluster,
  onTabClick,
  onClose,
  onTabDragStart,
  onTabDragOver,
  onTabDrop,
  onTabDragEnd,
}: FlatTabsProps) {
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <div className={classes.flatRow}>
      <div className={classes.scrollArea} role="tablist" aria-label="All sessions">
        {allSessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };
          const projectName = projectMap.get(session.projectId) ?? "Unknown";
          const agentColor = AGENT_COLOR[session.agentType] ?? "var(--accent)";

          return (
            <button
              key={session.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabClick(session)}
              className={classes.tabButton}
              data-active={isActive || undefined}
              data-dragging={session.id === draggedSessionId || undefined}
              data-drop-target={session.id === dropSessionId || undefined}
              draggable
              onDragStart={(event) => onTabDragStart(event, session.id)}
              onDragOver={(event) => onTabDragOver(event, session)}
              onDrop={(event) => onTabDrop(event, session)}
              onDragEnd={onTabDragEnd}
            >
              <span
                className={cn(classes.statusDot, statusColor.className)}
                style={{ '--status-color': statusColor.bg } as React.CSSProperties}
              />

              <div className={classes.twoLineLabel}>
                <div className={classes.flatMetaLine} style={{ '--agent-color': agentColor } as React.CSSProperties}>
                  <span className={classes.agentLabel}>
                    {AGENT_LABEL[session.agentType] ?? "?"}
                  </span>
                  <span className={classes.projectNameLabel}>
                    {projectName}
                  </span>
                </div>
                <span className={classes.sessionNameLabel}>{session.label}</span>
              </div>

              <button
                aria-label={`Close session ${session.label}`}
                onClick={(event) => onClose(event, session)}
                className={cn(classes.revealOnHover, classes.closeButton)}
              >
                <X size={10} />
              </button>
            </button>
          );
        })}
      </div>

      {actionCluster}
    </div>
  );
}

interface SessionTabProps {
  session: AgentSession;
  isActive: boolean;
  isDragged: boolean;
  isDropTarget: boolean;
  compact?: boolean;
  onTabClick: (session: AgentSession) => void;
  onClose: (event: MouseEvent, session: AgentSession) => void;
  onDragStart: (event: DragEvent<HTMLElement>, sessionId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

function SessionTab({
  session,
  isActive,
  isDragged,
  isDropTarget,
  compact,
  onTabClick,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SessionTabProps) {
  const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onTabClick(session)}
      className={classes.tabButton}
      data-active={isActive || undefined}
      data-dragging={isDragged || undefined}
      data-drop-target={isDropTarget || undefined}
      data-compact={compact || undefined}
      draggable
      onDragStart={(event) => onDragStart(event, session.id)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span
        className={classes.agentLabelCompact}
        style={{ '--agent-color': AGENT_COLOR[session.agentType] ?? 'var(--accent)' } as React.CSSProperties}
      >
        {AGENT_LABEL[session.agentType] ?? "?"}
      </span>
      <span
        className={cn(classes.statusDot, statusColor.className)}
        style={{ '--status-color': statusColor.bg } as React.CSSProperties}
      />
      <span className={classes.sessionNameLabel}>{session.label}</span>
      <button
        aria-label={`Close session ${session.label}`}
        onClick={(event) => onClose(event, session)}
        className={cn(classes.revealOnHover, classes.closeButton)}
      >
        <X size={10} />
      </button>
    </button>
  );
}
