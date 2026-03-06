import { useRef } from "react";
import { X, Plus, Shield, Layers, List } from "lucide-react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { killPty } from "@/lib/tauri";
import { teardownGuardian } from "@/lib/guardian";
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
  const { activeProjectId, projects, setActiveProject, updateProject } = useProjectStore();
  const { setActivePanel, tabViewMode, setTabViewMode } = useUiStore();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (session.isGuardian) {
      const confirmed = window.confirm(
        "This will disable the Guardian for this project. Continue?"
      );
      if (!confirmed) return;
      const project = projects.find((p) => p.id === session.projectId);
      await teardownGuardian(session.projectId);
      if (project) {
        await updateProject({ ...project, guardian_enabled: false }).catch(() => {});
      }
      return;
    }
    try {
      await killPty(session.id);
    } catch {
      // ignore
    }
    removeSession(session.id);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
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
          />
        ) : (
          <FlatTabs
            allSessions={allSessions}
            activeSessionId={activeSessionId}
            projects={projects}
            onTabClick={handleTabClick}
            onClose={handleClose}
          />
        )}
      </div>

      {/* View mode toggle + New session button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
        }}
      >
        <Tooltip label={tabViewMode === "grouped" ? "Switch to flat view" : "Switch to grouped view"} withArrow>
          <ActionIcon
            variant="subtle"
            onClick={() => setTabViewMode(tabViewMode === "grouped" ? "flat" : "grouped")}
            aria-label="Toggle tab view mode"
            style={{
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: 0,
              color: "var(--text-secondary)",
            }}
          >
            {tabViewMode === "grouped" ? <List size={14} /> : <Layers size={14} />}
          </ActionIcon>
        </Tooltip>
        <ActionIcon
          variant="subtle"
          onClick={onNewSession}
          aria-label="New terminal session"
          style={{
            width: "2.25rem",
            height: "2.25rem",
            flexShrink: 0,
            borderRadius: 0,
            borderLeft: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <Plus size={14} />
        </ActionIcon>
      </div>
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
}

function GroupedTabs({
  allSessions,
  activeSessionId,
  activeProjectId,
  projects,
  onTabClick,
  onClose,
  onProjectClick,
}: GroupedTabsProps) {
  // Get projects that have sessions
  const projectsWithSessions = projects.filter((p) =>
    allSessions.some((s) => s.projectId === p.id)
  );

  const activeProject = activeProjectId;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Level 1: Project tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "1.75rem",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          borderBottom: "1px solid var(--border)",
        }}
        role="tablist"
        aria-label="Projects"
      >
        {projectsWithSessions.map((project) => {
          const isActive = project.id === activeProject;
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

      {/* Level 2: Session tabs for active project */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "2rem",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
        role="tablist"
        aria-label="Sessions"
      >
        {allSessions
          .filter((s) => s.projectId === activeProject)
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
    </div>
  );
}

/* ─── Flat View ─────────────────────────────────────────── */

interface FlatTabsProps {
  allSessions: AgentSession[];
  activeSessionId: string | null;
  projects: { id: string; name: string }[];
  onTabClick: (session: AgentSession) => void;
  onClose: (e: React.MouseEvent, session: AgentSession) => void;
}

function FlatTabs({
  allSessions,
  activeSessionId,
  projects,
  onTabClick,
  onClose,
}: FlatTabsProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
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
                {session.isGuardian ? (
                  <Shield size={9} style={{ flexShrink: 0, color: "var(--guardian)" }} />
                ) : (
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.5625rem",
                      color: agentColor,
                    }}
                  >
                    {AGENT_LABEL[session.agentType] ?? "?"}
                  </span>
                )}
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
      {session.isGuardian ? (
        <Shield size={13} style={{ flexShrink: 0, color: "var(--guardian)" }} />
      ) : (
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
      )}
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
