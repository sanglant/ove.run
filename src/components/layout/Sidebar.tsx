import { useState, useEffect, useRef } from "react";
import {
  FolderGit2,
  BookOpen,
  StickyNote,
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
  claude: { label: "C", color: "var(--claude)" },
  gemini: { label: "G", color: "var(--gemini)" },
  copilot: { label: "P", color: "var(--copilot)" },
  codex: { label: "X", color: "var(--codex)" },
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
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
      }}
      aria-label="Sidebar navigation"
    >
      {/* App title */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          <span style={{ color: "var(--accent-glow)" }}>Ag</span>
          <span style={{ color: "var(--text-primary)" }}>entic</span>
        </h1>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "12px 12px 4px" }}>
          <Text
            size="xs"
            tt="uppercase"
            c="dimmed"
            style={{ letterSpacing: "0.05em", fontWeight: 600, fontSize: 10 }}
          >
            Projects
          </Text>
        </div>

        <ul role="list" style={{ padding: "0 8px", margin: 0, listStyle: "none" }}>
          {projects.map((project) => {
            const projectSessions = sessions.filter(
              (s) => s.projectId === project.id,
            );
            const isExpanded = expandedProjects.has(project.id);
            const isActiveProject = project.id === activeProjectId;

            return (
              <li key={project.id} style={{ marginBottom: 2 }}>
                {/* Project row */}
                <div
                  className={classes.row}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 4px",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "color 150ms",
                    color: isActiveProject
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
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
                    style={{
                      flexShrink: 0,
                      width: 16,
                      color: "var(--text-secondary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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
                      style={{
                        flexShrink: 0,
                        color: isActiveProject ? "var(--accent)" : undefined,
                      }}
                    />
                  ) : (
                    <Folder
                      size={14}
                      style={{
                        flexShrink: 0,
                        color: isActiveProject ? "var(--accent)" : undefined,
                      }}
                    />
                  )}

                  {/* Project name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                    }}
                  >
                    {project.name}
                  </span>

                  {/* Session count badge */}
                  {projectSessions.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "0 4px",
                        borderRadius: 9999,
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-secondary)",
                      }}
                    >
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
                        className={guardianActive ? undefined : classes.revealOnHover}
                        style={{
                          color: guardianActive ? "var(--guardian)" : "var(--text-secondary)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            lineHeight: 1,
                            fontWeight: 700,
                            color: guardianActive ? "var(--guardian)" : "var(--text-secondary)",
                          }}
                        >
                          G
                        </span>
                      </button>
                    );
                  })()}

                  {/* New agent button */}
                  <button
                    onClick={(e) => handleNewAgent(e, project.id)}
                    aria-label={`New agent session for ${project.name}`}
                    className={classes.revealOnHover}
                    style={{
                      color: "var(--text-secondary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Sessions list */}
                {isExpanded && projectSessions.length > 0 && (
                  <ul
                    style={{ marginLeft: 20, marginTop: 2, listStyle: "none", padding: 0 }}
                    role="list"
                  >
                    {projectSessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const agentIcon = AGENT_ICON[session.agentType];
                      const statusColor = STATUS_COLORS[session.status] ?? { bg: "var(--text-secondary)" };

                      return (
                        <li key={session.id} style={{ marginBottom: 2 }}>
                          <UnstyledButton
                            onClick={() => handleSessionClick(session.id, project.id)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              textAlign: "left",
                              transition: "background-color 150ms, color 150ms",
                              backgroundColor: isActive
                                ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                                : "transparent",
                              color: isActive
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            }}
                          >
                            {/* Status dot */}
                            <span
                              className={statusColor.className}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                flexShrink: 0,
                                backgroundColor: statusColor.bg,
                                display: "inline-block",
                              }}
                            />
                            {/* Agent icon */}
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 10,
                                width: 12,
                                textAlign: "center",
                                color: agentIcon?.color ?? "var(--accent)",
                              }}
                            >
                              {agentIcon?.label ?? "?"}
                            </span>
                            {/* Session label */}
                            <span
                              style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {session.label}
                            </span>
                            {/* YOLO badge */}
                            {session.yoloMode && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "var(--danger)",
                                  padding: "0 4px",
                                  borderRadius: 4,
                                  backgroundColor: "rgba(229,115,127,0.15)",
                                  border: "1px solid rgba(229,115,127,0.2)",
                                }}
                              >
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
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--border)",
        }}
      >
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
      <nav
        aria-label="Panel navigation"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "8px",
        }}
      >
        <Group justify="space-around" gap={0}>
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
                  size={32}
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
