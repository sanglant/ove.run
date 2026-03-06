import { X, Plus, Layers, List } from "lucide-react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { killPty } from "@/lib/tauri";
import type { AgentSession } from "@/types";
import classes from "./TerminalTabs.module.css";

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
  claude: "C",
  gemini: "G",
  copilot: "P",
  codex: "X",
  terminal: ">_",
};

const AGENT_COLOR: Record<string, string> = {
  claude: "var(--claude)",
  gemini: "var(--gemini)",
  copilot: "var(--copilot)",
  codex: "var(--codex)",
  terminal: "var(--text-secondary)",
};

export function TerminalTabs({ sessions, allSessions, onNewSession }: TerminalTabsProps) {
  const { activeSessionId, setActiveSession, removeSession } = useSessionStore();
  const { activeProjectId, projects, setActiveProject } = useProjectStore();
  const { setActivePanel, tabViewMode, setTabViewMode } = useUiStore();

  const handleTabClick = (session: AgentSession) => {
    setActiveProject(session.projectId);
    setActiveSession(session.id);
    setActivePanel("terminal");
  };

  const handleProjectTabClick = (projectId: string) => {
    setActiveProject(projectId);
    const firstSession = allSessions.find((s) => s.projectId === projectId);
    if (firstSession) {
      setActiveSession(firstSession.id);
    }
  };

  const handleClose = async (e: React.MouseEvent, session: AgentSession) => {
    e.stopPropagation();
    try {
      await killPty(session.id);
    } catch {
      // ignore
    }
    removeSession(session.id);
  };

  const viewToggle = (
    <Tooltip label={tabViewMode === "grouped" ? "Flat view" : "Grouped view"} withArrow>
      <ActionIcon
        variant="subtle"
        onClick={() => setTabViewMode(tabViewMode === "grouped" ? "flat" : "grouped")}
        aria-label="Toggle tab view mode"
        style={{
          width: "1.75rem",
          height: "1.75rem",
          borderRadius: 0,
          flexShrink: 0,
          color: "var(--text-secondary)",
        }}
      >
        {tabViewMode === "grouped" ? <List size={12} /> : <Layers size={12} />}
      </ActionIcon>
    </Tooltip>
  );

  const newButton = (
    <ActionIcon
      variant="subtle"
      onClick={onNewSession}
      aria-label="New session"
      style={{
        width: "1.75rem",
        height: "1.75rem",
        flexShrink: 0,
        borderRadius: 0,
        borderLeft: "1px solid var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      <Plus size={12} />
    </ActionIcon>
  );

  const handleKillActive = async () => {
    const active = allSessions.find((s) => s.id === activeSessionId);
    if (!active) return;
    try {
      await killPty(active.id);
    } catch {
      // ignore
    }
    removeSession(active.id);
  };

  const killButton = activeSessionId ? (
    <Tooltip label="Kill active session" withArrow>
      <ActionIcon
        variant="subtle"
        onClick={handleKillActive}
        aria-label="Kill active session"
        style={{
          width: "1.75rem",
          height: "1.75rem",
          flexShrink: 0,
          borderRadius: 0,
          borderLeft: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <X size={12} />
      </ActionIcon>
    </Tooltip>
  ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {tabViewMode === "grouped" ? (
        <GroupedTabs
          sessions={sessions}
          allSessions={allSessions}
          activeSessionId={activeSessionId}
          activeProjectId={activeProjectId}
          projects={projects}
          onTabClick={handleTabClick}
          onClose={handleClose}
          onProjectClick={handleProjectTabClick}
          viewToggle={viewToggle}
          newButton={newButton}
          killButton={killButton}
        />
      ) : (
        <FlatTabs
          allSessions={allSessions}
          activeSessionId={activeSessionId}
          projects={projects}
          onTabClick={handleTabClick}
          onClose={handleClose}
          viewToggle={viewToggle}
          newButton={newButton}
          killButton={killButton}
        />
      )}
    </div>
  );
}

/* ─── Grouped View ──────────────────────────────────────── */

interface GroupedTabsProps {
  sessions: AgentSession[];
  allSessions: AgentSession[];
  activeSessionId: string | null;
  activeProjectId: string | null;
  projects: { id: string; name: string }[];
  onTabClick: (session: AgentSession) => void;
  onClose: (e: React.MouseEvent, session: AgentSession) => void;
  onProjectClick: (projectId: string) => void;
  viewToggle: React.ReactNode;
  newButton: React.ReactNode;
  killButton: React.ReactNode;
}

function GroupedTabs({
  allSessions,
  activeSessionId,
  activeProjectId,
  projects,
  onTabClick,
  onClose,
  onProjectClick,
  viewToggle,
  newButton,
  killButton,
}: GroupedTabsProps) {
  const projectsWithSessions = projects.filter((p) =>
    allSessions.some((s) => s.projectId === p.id)
  );

  return (
    <>
      {/* Level 1: Project tabs + view toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "1.75rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
          }}
          role="tablist"
          aria-label="Projects"
        >
          {projectsWithSessions.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onProjectClick(project.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  height: "1.75rem",
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  flexShrink: 0,
                  border: "none",
                  borderRight: "1px solid var(--border)",
                  cursor: "pointer",
                  position: "relative",
                  backgroundColor: isActive ? "var(--bg-secondary)" : "var(--bg-primary)",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  transition: "background-color 150ms, color 150ms",
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "2px",
                      backgroundColor: "var(--accent)",
                    }}
                  />
                )}
                {project.name}
              </button>
            );
          })}
        </div>
        <div style={{ flexShrink: 0, borderLeft: "1px solid var(--border)" }}>
          {viewToggle}
        </div>
      </div>

      {/* Level 2: Session tabs + new button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
          }}
          role="tablist"
          aria-label="Sessions"
        >
          {allSessions
            .filter((s) => s.projectId === activeProjectId)
            .map((session) => (
              <SessionTab
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onTabClick={onTabClick}
                onClose={onClose}
                compact
              />
            ))}
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {newButton}
          {killButton}
        </div>
      </div>
    </>
  );
}

/* ─── Flat View ─────────────────────────────────────────── */

interface FlatTabsProps {
  allSessions: AgentSession[];
  activeSessionId: string | null;
  projects: { id: string; name: string }[];
  onTabClick: (session: AgentSession) => void;
  onClose: (e: React.MouseEvent, session: AgentSession) => void;
  viewToggle: React.ReactNode;
  newButton: React.ReactNode;
  killButton: React.ReactNode;
}

function FlatTabs({
  allSessions,
  activeSessionId,
  projects,
  onTabClick,
  onClose,
  viewToggle,
  newButton,
  killButton,
}: FlatTabsProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
        role="tablist"
        aria-label="All sessions"
      >
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
              className={classes.row}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                paddingLeft: "0.625rem",
                paddingRight: "0.625rem",
                height: "2.75rem",
                fontSize: "0.6875rem",
                flexShrink: 0,
                border: "none",
                borderRight: "1px solid var(--border)",
                cursor: "pointer",
                position: "relative",
                backgroundColor: isActive ? "var(--bg-secondary)" : "var(--bg-primary)",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                transition: "background-color 150ms, color 150ms",
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    backgroundColor: "var(--accent)",
                    boxShadow: "0 0 6px 0 var(--accent)",
                  }}
                />
              )}

              {/* Status dot */}
              <span
                className={statusColor.className}
                style={{
                  width: "0.375rem",
                  height: "0.375rem",
                  borderRadius: "9999px",
                  flexShrink: 0,
                  backgroundColor: statusColor.bg,
                }}
              />

              {/* Two-line label */}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                {/* Line 1: agent icon + project name */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.625rem" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.5625rem",
                      color: agentColor,
                    }}
                  >
                    {AGENT_LABEL[session.agentType] ?? "?"}
                  </span>
                  <span
                    style={{
                      color: agentColor,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "80px",
                    }}
                  >
                    {projectName}
                  </span>
                </div>
                {/* Line 2: session name */}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100px",
                    lineHeight: 1.2,
                  }}
                >
                  {session.label}
                </span>
              </div>

              {/* Close button */}
              <button
                aria-label={`Close session ${session.label}`}
                onClick={(e) => onClose(e, session)}
                className={classes.revealOnHover}
                style={{
                  marginLeft: "0.125rem",
                  borderRadius: "0.25rem",
                  padding: "0.125rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <X size={10} />
              </button>
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
        }}
      >
        {viewToggle}
        {newButton}
        {killButton}
      </div>
    </div>
  );
}

/* ─── Shared Session Tab (for grouped view) ─────────────── */

interface SessionTabProps {
  session: AgentSession;
  isActive: boolean;
  onTabClick: (session: AgentSession) => void;
  onClose: (e: React.MouseEvent, session: AgentSession) => void;
  compact?: boolean;
}

function SessionTab({ session, isActive, onTabClick, onClose, compact }: SessionTabProps) {
  const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onTabClick(session)}
      className={classes.row}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        paddingLeft: "0.75rem",
        paddingRight: "0.75rem",
        height: compact ? "2rem" : "2.25rem",
        fontSize: "0.75rem",
        flexShrink: 0,
        border: "none",
        borderRight: "1px solid var(--border)",
        cursor: "pointer",
        position: "relative",
        backgroundColor: isActive ? "var(--bg-secondary)" : "var(--bg-primary)",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        transition: "background-color 150ms, color 150ms",
      }}
    >
      {isActive && (
        <span
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: "var(--accent)",
            boxShadow: "0 0 6px 0 var(--accent)",
          }}
        />
      )}
      <span
        style={{
          fontWeight: "bold",
          fontSize: "10px",
          width: "1rem",
          textAlign: "center",
          color: AGENT_COLOR[session.agentType] ?? "var(--accent)",
        }}
      >
        {AGENT_LABEL[session.agentType] ?? "?"}
      </span>
      <span
        className={statusColor.className}
        style={{
          width: "0.375rem",
          height: "0.375rem",
          borderRadius: "9999px",
          flexShrink: 0,
          backgroundColor: statusColor.bg,
        }}
      />
      <span
        style={{
          maxWidth: "120px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {session.label}
      </span>
      <button
        aria-label={`Close session ${session.label}`}
        onClick={(e) => onClose(e, session)}
        className={classes.revealOnHover}
        style={{
          marginLeft: "0.25rem",
          borderRadius: "0.25rem",
          padding: "0.125rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          backgroundColor: "transparent",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <X size={10} />
      </button>
    </button>
  );
}
