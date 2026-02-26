import { useState } from "react";
import {
  FolderGit2,
  BookOpen,
  Settings,
  Bell,
  Plus,
  Terminal,
  ChevronRight,
  ChevronDown,
  Folder,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { NewProjectDialog } from "@/features/projects/components/NewProjectDialog";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import type { Project } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  starting: "bg-[var(--warning)]",
  idle: "bg-[var(--text-secondary)]",
  working: "bg-[var(--accent)] animate-pulse",
  needs_input: "bg-[var(--warning)] animate-pulse",
  finished: "bg-[var(--success)]",
  error: "bg-[var(--danger)]",
};

const AGENT_ICON: Record<string, { label: string; color: string }> = {
  claude: { label: "C", color: "text-[var(--accent)]" },
  gemini: { label: "G", color: "text-[var(--success)]" },
};

export function Sidebar() {
  const { projects, activeProjectId, setActiveProject } = useProjectStore();
  const { sessions, activeSessionId, setActiveSession } = useSessionStore();
  const { activePanel, setActivePanel } = useUiStore();
  const { unreadCount } = useNotificationStore();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [showNewProject, setShowNewProject] = useState(false);
  const [newAgentProjectId, setNewAgentProjectId] = useState<string | null>(null);

  const toggleProjectExpand = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleProjectClick = (project: Project) => {
    setActiveProject(project.id);
    if (!expandedProjects.has(project.id)) {
      toggleProjectExpand(project.id);
    }
  };

  const handleSessionClick = (sessionId: string, projectId: string) => {
    setActiveProject(projectId);
    setActiveSession(sessionId);
    setActivePanel("terminal");
  };

  const handleNewAgent = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setActiveProject(projectId);
    setNewAgentProjectId(projectId);
  };

  const navItems = [
    {
      id: "terminal" as const,
      icon: <Terminal size={16} />,
      label: "Terminal",
    },
    {
      id: "git" as const,
      icon: <FolderGit2 size={16} />,
      label: "Git",
    },
    {
      id: "knowledge" as const,
      icon: <BookOpen size={16} />,
      label: "Knowledge",
    },
    {
      id: "settings" as const,
      icon: <Settings size={16} />,
      label: "Settings",
    },
    {
      id: "notifications" as const,
      icon: <Bell size={16} />,
      label: "Notifications",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  return (
    <aside
      className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border)]"
      aria-label="Sidebar navigation"
    >
      {/* App title */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
          <span className="text-[var(--accent)]">Ag</span>entic
        </h1>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Projects
          </span>
        </div>

        <ul role="list" className="px-2 space-y-0.5">
          {projects.map((project) => {
            const projectSessions = sessions.filter(
              (s) => s.projectId === project.id,
            );
            const isExpanded = expandedProjects.has(project.id);
            const isActiveProject = project.id === activeProjectId;

            return (
              <li key={project.id}>
                {/* Project row */}
                <div
                  className={[
                    "flex items-center gap-1 px-1 py-1.5 rounded cursor-pointer transition-colors group",
                    isActiveProject
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  ].join(" ")}
                  onClick={() => handleProjectClick(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProjectClick(project);
                  }}
                >
                  {/* Expand toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectExpand(project.id);
                    }}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    aria-expanded={isExpanded}
                    className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-4"
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </button>

                  {/* Project icon */}
                  {project.git_enabled ? (
                    <FolderGit2
                      size={14}
                      className={
                        isActiveProject ? "text-[var(--accent)]" : "shrink-0"
                      }
                    />
                  ) : (
                    <Folder
                      size={14}
                      className={
                        isActiveProject ? "text-[var(--accent)]" : "shrink-0"
                      }
                    />
                  )}

                  {/* Project name */}
                  <span className="flex-1 text-xs truncate font-medium">
                    {project.name}
                  </span>

                  {/* Session count badge */}
                  {projectSessions.length > 0 && (
                    <span className="text-[10px] px-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                      {projectSessions.length}
                    </span>
                  )}

                  {/* New agent button */}
                  <button
                    onClick={(e) => handleNewAgent(e, project.id)}
                    aria-label={`New agent session for ${project.name}`}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-opacity"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Sessions list */}
                {isExpanded && projectSessions.length > 0 && (
                  <ul className="ml-5 mt-0.5 space-y-0.5" role="list">
                    {projectSessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const agentIcon = AGENT_ICON[session.agentType];

                      return (
                        <li key={session.id}>
                          <button
                            onClick={() => handleSessionClick(session.id, project.id)}
                            className={[
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                              isActive
                                ? "bg-[var(--accent)]/15 text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                            ].join(" ")}
                          >
                            {/* Status dot */}
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[session.status] ?? "bg-[var(--text-secondary)]"}`}
                            />
                            {/* Agent icon */}
                            <span
                              className={`font-bold text-[10px] w-3 text-center ${agentIcon?.color ?? "text-[var(--accent)]"}`}
                            >
                              {agentIcon?.label ?? "?"}
                            </span>
                            {/* Session label */}
                            <span className="flex-1 truncate">{session.label}</span>
                            {/* YOLO badge */}
                            {session.yoloMode && (
                              <span className="text-[9px] font-bold text-[var(--danger)] px-1 rounded bg-[var(--danger)]/10">
                                Y
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add project button */}
      <div className="px-3 py-2 border-t border-[var(--border)]">
        <button
          onClick={() => setShowNewProject(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Plus size={13} />
          Add Project
        </button>
      </div>

      {/* Bottom nav icons */}
      <nav
        className="flex items-center justify-around px-2 py-2 border-t border-[var(--border)]"
        aria-label="Panel navigation"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            aria-label={item.label}
            aria-pressed={activePanel === item.id}
            title={item.label}
            className={[
              "relative flex items-center justify-center w-8 h-8 rounded transition-colors",
              activePanel === item.id
                ? "text-[var(--accent)] bg-[var(--accent)]/10"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
            ].join(" ")}
          >
            {item.icon}
            {item.badge !== undefined && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-[var(--danger)] text-white text-[9px] font-bold px-0.5">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Dialogs */}
      {showNewProject && (
        <NewProjectDialog onClose={() => setShowNewProject(false)} />
      )}
      {newAgentProjectId && (
        <NewAgentDialog
          projectId={newAgentProjectId}
          onClose={() => setNewAgentProjectId(null)}
        />
      )}
    </aside>
  );
}
