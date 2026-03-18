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
  Brain,
  BarChart3,
  Shield,
  Trash2,
  FolderOpen,
  X,
} from "lucide-react";
import {
  ActionIcon,
  Button,
  Group,
  Indicator,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { AppModal } from "@/components/ui/AppModal";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useProjectStore } from "@/stores/projectStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useArbiterStore } from "@/stores/arbiterStore";
import { NewProjectDialog } from "@/features/projects/components/NewProjectDialog";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import { TrustLevelSelector } from "@/features/arbiter/components/TrustLevelSelector";
import type { Project, TrustLevel } from "@/types";
import { getAgentMeta } from "@/constants/agents";
import { StatusDot } from "@/components/ui/StatusDot";
import { killPty } from "@/lib/tauri";
import cn from "clsx";
import classes from "./Sidebar.module.css";

const ADD_PROJECT_BUTTON_STYLES = {
  root: {
    color: "var(--text-secondary)",
    justifyContent: "flex-start",
    fontSize: 12,
    height: "auto",
    padding: "8px 12px",
    "--button-hover-color": "var(--text-primary)",
    "--button-hover": "var(--bg-tertiary)",
  },
} as const;

const CANCEL_BUTTON_STYLES = {
  root: { color: "var(--text-secondary)" },
} as const;

const CONFIRM_BUTTON_STYLES = {
  root: {
    backgroundColor: "var(--accent)",
    color: "var(--bg-primary)",
  },
} as const;

const NAV_ICON_STYLES = (isActive: boolean) => ({
  root: {
    color: isActive ? "var(--accent-glow)" : "var(--text-secondary)",
    backgroundColor: isActive
      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
      : "transparent",
    borderTop: isActive
      ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
      : "1px solid transparent",
    borderRadius: 4,
    transition: "color 150ms, background-color 150ms, transform 150ms ease",
  },
});

type ContextMenuState =
  | { type: "project"; id: string; x: number; y: number }
  | { type: "session"; id: string; projectId: string; x: number; y: number }
  | null;

export function Sidebar() {
  const { projects, activeProjectId, setActiveProject, updateProject, removeProject } = useProjectStore();
  const { sessions, activeSessionId, setActiveSession, removeSession } = useSessionStore();
  const { activePanel, setActivePanel } = useUiStore();
  const { notifications } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [showNewProject, setShowNewProject] = useState(false);
  const [newAgentProjectId, setNewAgentProjectId] = useState<string | null>(null);
  const [trustLevelProject, setTrustLevelProject] = useState<Project | null>(null);
  const [pendingTrustLevel, setPendingTrustLevel] = useState<TrustLevel>(2);
  const [pendingRemoveProject, setPendingRemoveProject] = useState<Project | null>(null);
  const [removing, setRemoving] = useState(false);
  const { setTrustLevel: saveTrustLevel } = useArbiterStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

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

  const handleNewAgent = (projectId: string) => {
    setActiveProject(projectId);
    setNewAgentProjectId(projectId);
  };

  const handleSessionDragStart = (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-ove-run-session", sessionId);
    event.dataTransfer.setData("text/plain", sessionId);
  };

  const handleArbiterToggle = async (project: Project) => {
    if (project.arbiter_enabled) {
      await updateProject({ ...project, arbiter_enabled: false });
    } else {
      setPendingTrustLevel(2);
      setTrustLevelProject(project);
    }
  };

  const handleConfirmTrustLevel = async () => {
    if (!trustLevelProject) return;
    await saveTrustLevel(trustLevelProject.id, pendingTrustLevel);
    await updateProject({ ...trustLevelProject, arbiter_enabled: true });
    setTrustLevelProject(null);
  };

  const handleCloseSession = (sessionId: string) => {
    removeSession(sessionId);
    killPty(sessionId).catch((err: unknown) => {
      const message = typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : String(err);
      if (!message.includes("not found")) {
        console.error("Failed to kill PTY for session:", sessionId, err);
      }
    });
  };

  const navItems = [
    {
      id: "terminal" as const,
      icon: <Terminal size={16} />,
      label: "Terminal",
      tourId: "sidebar-terminal",
    },
    {
      id: "git" as const,
      icon: <FolderGit2 size={16} />,
      label: "Git",
      tourId: "sidebar-git",
    },
    {
      id: "context" as const,
      icon: <BookOpen size={16} />,
      label: "Context",
      tourId: "sidebar-knowledge",
    },
    {
      id: "notes" as const,
      icon: <StickyNote size={16} />,
      label: "Notes",
      tourId: "sidebar-notes",
    },
    {
      id: "bugs" as const,
      icon: <Bug size={16} />,
      label: "Bugs",
      tourId: "sidebar-bugs",
    },
    {
      id: "memory" as const,
      icon: <Brain size={16} />,
      label: "Memory",
      tourId: "sidebar-memory",
    },
    {
      id: "stats" as const,
      icon: <BarChart3 size={16} />,
      label: "Stats",
      tourId: "sidebar-stats",
    },
    {
      id: "settings" as const,
      icon: <Settings size={16} />,
      label: "Settings",
      tourId: "sidebar-settings",
    },
    {
      id: "notifications" as const,
      icon: <Bell size={16} />,
      label: "Notifications",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  // Resolve the project/session referenced by the open context menu
  const ctxProject = contextMenu?.type === "project"
    ? projects.find((p) => p.id === contextMenu.id) ?? null
    : contextMenu?.type === "session"
    ? projects.find((p) => p.id === contextMenu.projectId) ?? null
    : null;
  const ctxSession = contextMenu?.type === "session"
    ? sessions.find((s) => s.id === contextMenu.id) ?? null
    : null;

  return (
    <aside className={classes.sidebar} aria-label="Sidebar navigation">
      {/* App title */}
      <div className={classes.header}>
        <h1 className={classes.title}>
          <img src="/ove.svg" alt="ove.run" className={classes.logo} />
        </h1>
      </div>

      {/* Project list */}
      <div className={classes.projectsScroll} data-tour="sidebar-project-list">
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ type: "project", id: project.id, x: e.clientX, y: e.clientY });
                  }}
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

                  {/* Arbiter toggle button */}
                  {(() => {
                    const arbiterActive = project.arbiter_enabled;
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArbiterToggle(project);
                        }}
                        aria-label={arbiterActive ? `Disable arbiter for ${project.name}` : `Enable arbiter for ${project.name}`}
                        aria-pressed={arbiterActive}
                        className={cn(classes.iconButton, arbiterActive ? classes.arbiterActive : classes.revealOnHover)}
                        {...(isActiveProject ? { "data-tour": "project-arbiter-toggle" } : {})}
                      >
                        <span className={cn(classes.arbiterLabel, arbiterActive && classes.arbiterActive)}>
                          A
                        </span>
                      </button>
                    );
                  })()}

                  {/* New agent button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewAgent(project.id);
                    }}
                    aria-label={`New agent session for ${project.name}`}
                    className={cn(classes.iconButton, classes.revealOnHover)}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Sessions list */}
                {isExpanded && projectSessions.length > 0 && (
                  <ul className={classes.sessionList} role="list">
                    {projectSessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const agentMeta = getAgentMeta(session.agentType);

                      return (
                        <li key={session.id} className={classes.sessionItem}>
                          <UnstyledButton
                            onClick={() => handleSessionClick(session.id, project.id)}
                            onContextMenu={(e: React.MouseEvent) => {
                              e.preventDefault();
                              setContextMenu({
                                type: "session",
                                id: session.id,
                                projectId: project.id,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            draggable
                            onDragStart={(event: DragEvent<HTMLButtonElement>) =>
                              handleSessionDragStart(event, session.id)
                            }
                            className={cn(classes.sessionButton, isActive && classes.sessionButtonActive)}
                          >
                            {/* Status dot */}
                            <StatusDot status={session.status} />
                            {/* Agent icon */}
                            <span
                              className={classes.agentIcon}
                              style={{ '--agent-color': agentMeta.color } as React.CSSProperties}
                            >
                              {agentMeta.label}
                            </span>
                            {/* Session label */}
                            <Text size="sm" className={classes.sessionLabel}>
                              {session.label}
                            </Text>
                            {/* Sandboxed indicator */}
                            {session.sandboxed && <Shield size={11} color="var(--text-secondary)" />}
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
          styles={ADD_PROJECT_BUTTON_STYLES}
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
                  {...("tourId" in item ? { "data-tour": item.tourId } : {})}
                  styles={NAV_ICON_STYLES(isActive)}
                  className={classes.navButton}
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

      <AppModal
        opened={!!trustLevelProject}
        onClose={() => setTrustLevelProject(null)}
        title="Select trust level"
        centered
        size="sm"
        bodyPadding={20}
      >
        <Text size="xs" c="var(--text-secondary)" mb="md">
          How much autonomy should the Arbiter have for{" "}
          <strong>{trustLevelProject?.name}</strong>?
        </Text>
        <TrustLevelSelector
          value={pendingTrustLevel}
          onChange={setPendingTrustLevel}
        />
        <div className={classes.trustInfoBox}>
          <Text size="xs" fw={600} c="var(--text-primary)" mb={6}>How the Arbiter works</Text>
          <Text size="xs" c="var(--text-secondary)" lh={1.6} mb={4}>
            <strong className={classes.trustInfoStrong}>Console:</strong> Monitors agent sessions for questions and permission prompts. When an agent gets stuck, the Arbiter reviews the context and answers automatically based on the trust level.
          </Text>
          <Text size="xs" c="var(--text-secondary)" lh={1.6}>
            <strong className={classes.trustInfoStrong}>Loop:</strong> Acts as the orchestrator for multi-step workflows. Decomposes your request into stories, assigns them to agent sessions, reviews quality gates after each iteration, and decides whether to proceed, retry, or pause.
          </Text>
        </div>
        <div className={classes.trustModalFooter}>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setTrustLevelProject(null)}
            styles={CANCEL_BUTTON_STYLES}
          >
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={() => void handleConfirmTrustLevel()}
            styles={CONFIRM_BUTTON_STYLES}
          >
            Enable Arbiter
          </Button>
        </div>
      </AppModal>

      <AppModal
        opened={!!pendingRemoveProject}
        onClose={() => !removing && setPendingRemoveProject(null)}
        title="Remove project"
        centered
        size="sm"
        bodyPadding={20}
      >
        <Text size="sm" c="var(--text-secondary)" mb={4}>
          Remove <strong>{pendingRemoveProject?.name}</strong> from ove.run?
        </Text>
        <Text size="xs" c="var(--text-tertiary)" mb="md">
          Sessions, memories, and context for this project will be deleted. Files on disk are not affected.
        </Text>
        <div className={classes.trustModalFooter}>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setPendingRemoveProject(null)}
            disabled={removing}
            styles={CANCEL_BUTTON_STYLES}
          >
            Cancel
          </Button>
          <Button
            size="xs"
            color="red"
            onClick={async () => {
              if (!pendingRemoveProject) return;
              setRemoving(true);
              try {
                await removeProject(pendingRemoveProject.id);
                setPendingRemoveProject(null);
              } catch {
                // error handled by store toast
              } finally {
                setRemoving(false);
              }
            }}
            disabled={removing}
            styles={{
              root: {
                backgroundColor: "var(--danger)",
                color: "var(--bg-primary)",
                "&:hover": { backgroundColor: "color-mix(in srgb, var(--danger) 85%, white)" },
              },
            }}
          >
            {removing ? "Removing…" : "Remove project"}
          </Button>
        </div>
      </AppModal>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={classes.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label={contextMenu.type === "project" ? "Project actions" : "Session actions"}
        >
          {contextMenu.type === "project" && ctxProject && (
            <>
              <button
                className={classes.contextMenuItem}
                role="menuitem"
                onClick={() => {
                  handleNewAgent(ctxProject.id);
                  setContextMenu(null);
                }}
              >
                <Plus size={13} className={classes.contextMenuItemIcon} />
                New session
              </button>
              <button
                className={classes.contextMenuItem}
                role="menuitem"
                onClick={() => {
                  void shellOpen(ctxProject.path);
                  setContextMenu(null);
                }}
              >
                <FolderOpen size={13} className={classes.contextMenuItemIcon} />
                Open in file manager
              </button>
              <div className={classes.contextMenuSeparator} role="separator" />
              <button
                className={classes.contextMenuItem}
                role="menuitem"
                onClick={() => {
                  void handleArbiterToggle(ctxProject);
                  setContextMenu(null);
                }}
              >
                <Shield size={13} className={classes.contextMenuItemIcon} />
                {ctxProject.arbiter_enabled ? "Disable Arbiter" : "Enable Arbiter"}
              </button>
              <div className={classes.contextMenuSeparator} role="separator" />
              <button
                className={cn(classes.contextMenuItem, classes.contextMenuItemDanger)}
                role="menuitem"
                onClick={() => {
                  setPendingRemoveProject(ctxProject);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} className={classes.contextMenuItemIcon} />
                Remove project
              </button>
            </>
          )}

          {contextMenu.type === "session" && ctxSession && (
            <>
              <button
                className={classes.contextMenuItem}
                role="menuitem"
                onClick={() => {
                  handleSessionClick(ctxSession.id, ctxSession.projectId);
                  setContextMenu(null);
                }}
              >
                <Terminal size={13} className={classes.contextMenuItemIcon} />
                Focus terminal
              </button>
              <div className={classes.contextMenuSeparator} role="separator" />
              <button
                className={cn(classes.contextMenuItem, classes.contextMenuItemDanger)}
                role="menuitem"
                onClick={() => {
                  handleCloseSession(ctxSession.id);
                  setContextMenu(null);
                }}
              >
                <X size={13} className={classes.contextMenuItemIcon} />
                Close session
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
