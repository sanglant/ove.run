import type { DriveStep } from "driver.js";

export const terminalTour: DriveStep[] = [
  {
    element: '[data-tour="terminal-tabs"]',
    popover: {
      title: "Session Tabs",
      description: "Switch between agent sessions. Drag tabs to reorder them.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="terminal-layout"]',
    popover: {
      title: "Layout Mode",
      description: "Change terminal layout between single pane and grid mode.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="terminal-new-session"]',
    popover: {
      title: "New Session",
      description: "Start a new agent session for the active project.",
      side: "bottom",
      align: "center",
    },
  },
];
