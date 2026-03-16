import type { DriveStep } from "driver.js";

export const homeTour: DriveStep[] = [
  {
    element: '[data-tour="sidebar-project-list"]',
    popover: {
      title: "Projects",
      description: "Create projects to organize your agent sessions.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="sidebar-terminal"]',
    popover: {
      title: "Terminal",
      description: "Run AI agent sessions in the terminal.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-git"]',
    popover: {
      title: "Git",
      description: "View repository status, diffs, and make commits.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-knowledge"]',
    popover: {
      title: "Context",
      description: "Manage system prompts and context files for agents.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-notes"]',
    popover: {
      title: "Notes",
      description: "Keep project notes and documentation.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-bugs"]',
    popover: {
      title: "Bug Tracker",
      description: "Track and delegate bugs from Jira, GitHub, or YouTrack.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-settings"]',
    popover: {
      title: "Settings",
      description: "Configure app preferences, Arbiter provider, and more.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="project-arbiter-toggle"]',
    popover: {
      title: "Arbiter",
      description:
        "Arbiter auto-answers agent questions using AI. Enable per-project from the project list.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="statusbar-notifications"]',
    popover: {
      title: "Notifications",
      description: "Get notified about agent activity and Arbiter decisions.",
      side: "top",
      align: "end",
    },
  },
];
