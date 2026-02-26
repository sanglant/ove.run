import { useRef } from "react";
import { X, Plus } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { killPty } from "@/lib/tauri";
import type { AgentSession } from "@/types";

interface TerminalTabsProps {
  sessions: AgentSession[];
  onNewSession: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  starting: "bg-[var(--warning)]",
  idle: "bg-[var(--text-secondary)]",
  working: "bg-[var(--accent)]",
  needs_input: "bg-[var(--warning)]",
  finished: "bg-[var(--success)]",
  error: "bg-[var(--danger)]",
};

const AGENT_LABEL: Record<string, string> = {
  claude: "C",
  gemini: "G",
};

const AGENT_COLOR: Record<string, string> = {
  claude: "text-[var(--accent)]",
  gemini: "text-[var(--success)]",
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
    <div className="flex items-center h-9 bg-[var(--bg-primary)] border-b border-[var(--border)] shrink-0">
      <div
        ref={scrollRef}
        className="flex items-center flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
        role="tablist"
        aria-label="Terminal sessions"
      >
        {sessions
          .filter((s) => s.projectId === activeProjectId)
          .map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(session)}
                className={[
                  "group flex items-center gap-1.5 px-3 h-9 text-xs shrink-0 border-r border-[var(--border)] transition-colors relative",
                  isActive
                    ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                )}
                <span
                  className={`font-bold text-[10px] w-4 text-center ${AGENT_COLOR[session.agentType] ?? "text-[var(--accent)]"}`}
                >
                  {AGENT_LABEL[session.agentType] ?? "?"}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[session.status] ?? "bg-[var(--text-secondary)]"}`}
                />
                <span className="max-w-[120px] truncate">{session.label}</span>
                <button
                  aria-label={`Close session ${session.label}`}
                  onClick={(e) => handleClose(e, session)}
                  className="ml-1 opacity-0 group-hover:opacity-100 rounded hover:bg-[var(--bg-tertiary)] p-0.5 transition-opacity"
                >
                  <X size={10} />
                </button>
              </button>
            );
          })}
      </div>

      <button
        onClick={onNewSession}
        aria-label="New terminal session"
        className="flex items-center justify-center w-9 h-9 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border-l border-[var(--border)]"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
