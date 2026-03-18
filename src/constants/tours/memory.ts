import type { DriveStep } from "driver.js";

export const memoryTour: DriveStep[] = [
  {
    element: '[data-tour="memory-tabs"]',
    popover: {
      title: "Memories & Summaries",
      description:
        "Switch between individual memories extracted from agent sessions and consolidated summaries that distill patterns over time.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="memory-search"]',
    popover: {
      title: "Search Memories",
      description:
        "Full-text search across all agent memories for the active project. Results update as you type.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="memory-list"]',
    popover: {
      title: "Memory Cards",
      description:
        "Each card shows a memory extracted by an agent — its content, tags, importance score, and visibility. Toggle visibility to control what agents can recall.",
      side: "top",
      align: "start",
    },
  },
];
