import type { DriveStep } from "driver.js";

export const bugsTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-list"]',
    popover: {
      title: "Bug List",
      description: "Browse and search bugs from your connected provider.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-detail"]',
    popover: {
      title: "Bug Details",
      description: "View full bug details including status, priority, and description.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-delegate"]',
    popover: {
      title: "Delegate to Agent",
      description: "Send a bug to an AI agent for fixing. Creates a pre-filled agent session.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="bugs-refresh"]',
    popover: {
      title: "Refresh",
      description: "Sync latest bugs from your provider.",
      side: "bottom",
      align: "center",
    },
  },
];
