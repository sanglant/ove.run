import { useState, useEffect, useRef, type DragEvent } from "react";
import {
  FolderGit2,
  BookOpen,
  StickyNote,
  Bug,
  Settings,
  Bell,
  Plus,
  Terminal,
  ChevronRight,
  ChevronDown,
  Folder,
} from "lucide-react";
import {
  ActionIcon,
  Button,
  Group,
  Indicator,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useProjectStore } from "@/stores/projectStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { NewProjectDialog } from "@/features/projects/components/NewProjectDialog";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import type { Project } from "@/types";
import cn from "classnames";
import classes from "./Sidebar.module.css";

const STATUS_COLORS: Record<string, { bg: string; className?: string }> = {
  starting: { bg: "var(--warning)" },
  idle: { bg: "var(--text-secondary)" },
  working: { bg: "var(--accent)", className: "animate-pulse-glow" },
  needs_input: { bg: "var(--warning)", className: "animate-status-pulse" },
  finished: { bg: "var(--success)" },
  error: { bg: "var(--danger)" },
};

const AGENT_ICON: Record<string, { label: string; color: string }> = {
  claude: { label: "CC", color: "var(--claude)" },
  gemini: { label: "GC", color: "var(--gemini)" },
  copilot: { label: "CP", color: "var(--copilot)" },
  codex: { label: "CX", color: "var(--codex)" },
  terminal: { label: ">_", color: "var(--text-secondary)" },
};

export function Sidebar() {
  const { projects, activeProjectId, setActiveProject, updateProject } = useProjectStore();
  const { sessions, activeSessionId, setActiveSession } = useSessionStore();
  const { activePanel, setActivePanel } = useUiStore();
  const { unreadCount } = useNotificationStore();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [showNewProject, setShowNewProject] = useState(false);
  const [newAgentProjectId, setNewAgentProjectId] = useState<string | null>(null);

  // Auto-expand projects that have sessions
  const prevSessionCountRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const projectSessionCounts: Record<string, number> = {};
    for (const s of sessions) {
      projectSessionCounts[s.projectId] = (projectSessionCounts[s.projectId] ?? 0) + 1;
    }

    const toExpand: string[] = [];
    for (const [projectId, count] of Object.entries(projectSessionCounts)) {
      const prev = prevSessionCountRef.current[projectId] ?? 0;
      if (count > prev) {
        toExpand.push(projectId);
      }
    }
    prevSessionCountRef.current = projectSessionCounts;

    if (toExpand.length > 0) {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    }
  }, [sessions]);

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

  const handleSessionDragStart = (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-agentic-session", sessionId);
    event.dataTransfer.setData("text/plain", sessionId);
  };

  const handleGuardianToggle = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    const newEnabled = !project.guardian_enabled;
    await updateProject({ ...project, guardian_enabled: newEnabled });
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
      id: "notes" as const,
      icon: <StickyNote size={16} />,
      label: "Notes",
    },
    {
      id: "bugs" as const,
      icon: <Bug size={16} />,
      label: "Bugs",
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
    <aside className={classes.sidebar} aria-label="Sidebar navigation">
      {/* App title */}
      <div className={classes.header}>
        <h1 className={classes.title}>
          <span className={classes.titleAccent}>Ag</span>
          <span className={classes.titleText}>entic</span>
        </h1>
      </div>

      {/* Project list */}
      <div className={classes.projectsScroll}>
        <div className={classes.sectionLabel}>
          <Text
            size="xs"
            tt="uppercase"
            c="dimmed"
            fz={10}
            fw={600}
            lts="0.05em"
          >
            Projects
          </Text>
        </div>

        <ul role="list" className={classes.projectList}>
          {projects.map((project) => {
            const projectSessions = sessions.filter(
              (s) => s.projectId === project.id,
            );
            const isExpanded = expandedProjects.has(project.id);
            const isActiveProject = project.id === activeProjectId;

            return (
              <li key={project.id} className={classes.projectItem}>
                {/* Project row */}
                <div
                  className={cn(classes.row, classes.projectRow, isActiveProject && classes.projectRowActive)}
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
                    className={classes.expandToggle}
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
                      className={cn(classes.projectIcon, isActiveProject && classes.projectIconActive)}
                    />
                  ) : (
                    <Folder
                      size={14}
                      className={cn(classes.projectIcon, isActiveProject && classes.projectIconActive)}
                    />
                  )}

                  {/* Project name */}
                  <span className={classes.projectName}>
                    {project.name}
                  </span>

                  {/* Session count badge */}
                  {projectSessions.length > 0 && (
                    <span className={classes.sessionCountBadge}>
                      {projectSessions.length}
                    </span>
                  )}

                  {/* Guardian toggle button */}
                  {(() => {
                    const guardianActive = project.guardian_enabled;
                    return (
                      <button
                        onClick={(e) => handleGuardianToggle(e, project)}
                        aria-label={guardianActive ? `Disable guardian for ${project.name}` : `Enable guardian for ${project.name}`}
                        aria-pressed={guardianActive}
                        className={cn(classes.iconButton, guardianActive ? classes.guardianActive : classes.revealOnHover)}
                      >
                        <span className={cn(classes.guardianLabel, guardianActive && classes.guardianActive)}>
                          G
                        </span>
                      </button>
                    );
                  })()}

                  {/* New agent button */}
                  <button
                    onClick={(e) => handleNewAgent(e, project.id)}
                    aria-label={`New agent session for ${project.name}`}
                    className={cn(classes.iconButton, classes.revealOnHover)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Sessions list */}
                {isExpanded && projectSessions.length > 0 && (
                  <ul className={classes.sessionList} role="list">
                    {projectSessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const agentIcon = AGENT_ICON[session.agentType];
                      const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };

                      return (
                        <li key={session.id} className={classes.sessionItem}>
                          <UnstyledButton
                            onClick={() => handleSessionClick(session.id, project.id)}
                            draggable
                            onDragStart={(event: DragEvent<HTMLButtonElement>) =>
                              handleSessionDragStart(event, session.id)
                            }
                            className={cn(classes.sessionButton, isActive && classes.sessionButtonActive)}
                          >
                            {/* Status dot */}
                            <span
                              className={cn(classes.statusDot, statusColor.className)}
                              style={{ '--status-color': statusColor.bg } as React.CSSProperties}
                            />
                            {/* Agent icon */}
                            <span
                              className={classes.agentIcon}
                              style={{ '--agent-color': agentIcon?.color ?? 'var(--accent)' } as React.CSSProperties}
                            >
                              {agentIcon?.label ?? "?"}
                            </span>
                            {/* Session label */}
                            <Text size="sm" className={classes.sessionLabel}>
                              {session.label}
                            </Text>
                            {/* YOLO badge */}
                            {session.yoloMode && (
                              <span className={classes.yoloBadge}>
                                Y
                              </span>
                            )}
                          </UnstyledButton>
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
      <div className={classes.addProjectSection}>
        <Button
          variant="subtle"
          fullWidth
          leftSection={<Plus size={13} />}
          onClick={() => setShowNewProject(true)}
          size="xs"
          styles={{
            root: {
              color: "var(--text-secondary)",
              justifyContent: "flex-start",
              fontSize: 12,
              height: "auto",
              padding: "8px 12px",
              "--button-hover-color": "var(--text-primary)",
              "--button-hover": "var(--bg-tertiary)",
            },
          }}
        >
          Add Project
        </Button>
      </div>

      {/* Bottom nav icons */}
      <nav aria-label="Panel navigation" className={classes.nav}>
        <Group justify="space-between" align="center" gap={2} w="100%">
          {navItems.map((item) => {
            const isActive = activePanel === item.id;
            return (
              <Indicator
                key={item.id}
                disabled={!item.badge}
                label={item.badge && item.badge > 99 ? "99+" : item.badge}
                size={14}
                color="var(--danger)"
                styles={{ indicator: { fontSize: 9, fontWeight: 700 } }}
              >
                <ActionIcon
                  variant="subtle"
                  onClick={() => setActivePanel(item.id)}
                  aria-label={item.label}
                  aria-pressed={isActive}
                  title={item.label}
                  size={28}
                  styles={{
                    root: {
                      color: isActive ? "var(--accent-glow)" : "var(--text-secondary)",
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : "transparent",
                      borderTop: isActive
                        ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                        : "1px solid transparent",
                      borderRadius: 4,
                      transition: "color 150ms, background-color 150ms",
                    },
                  }}
                >
                  {item.icon}
                </ActionIcon>
              </Indicator>
            );
          })}
        </Group>
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
