import { useRef } from "react";
import { X, Plus } from "lucide-react";
import { ActionIcon } from "@mantine/core";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { killPty } from "@/lib/tauri";
import type { AgentSession } from "@/types";
import classes from "./TerminalTabs.module.css";

interface TerminalTabsProps {
  sessions: AgentSession[];
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
};

const AGENT_COLOR: Record<string, string> = {
  claude: "var(--claude)",
  gemini: "var(--gemini)",
};

export function TerminalTabs({ sessions, onNewSession }: TerminalTabsProps) {
  const { activeSessionId, setActiveSession, removeSession } = useSessionStore();
  const { activeProjectId } = useProjectStore();
  const { setActivePanel } = useUiStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (session: AgentSession) => {
    setActiveSession(session.id);
    setActivePanel("terminal");
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "2.25rem",
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
        role="tablist"
        aria-label="Terminal sessions"
      >
        {sessions
          .filter((s) => s.projectId === activeProjectId)
          .map((session) => {
            const isActive = session.id === activeSessionId;
            const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };

            return (
              <button
                key={session.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(session)}
                className={classes.row}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  height: "2.25rem",
                  fontSize: "0.75rem",
                  flexShrink: 0,
                  border: "none",
                  borderRight: "1px solid var(--border)",
                  transition: "background-color 150ms, color 150ms",
                  position: "relative",
                  cursor: "pointer",
                  backgroundColor: isActive ? "var(--bg-secondary)" : "var(--bg-primary)",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-tertiary)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-primary)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }
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
                  onClick={(e) => handleClose(e, session)}
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
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-tertiary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  <X size={10} />
                </button>
              </button>
            );
          })}
      </div>

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
  );
}
