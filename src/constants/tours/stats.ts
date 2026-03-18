import type { DriveStep } from "driver.js";

export const statsTour: DriveStep[] = [
  {
    element: '[data-tour="stats-overview"]',
    popover: {
      title: "Project Overview",
      description:
        "At-a-glance counts for sessions, loop iterations, notes, context entries, memories, and summaries for the active project.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="stats-loop"]',
    popover: {
      title: "Loop Engine",
      description:
        "Current loop status, total iteration count, and story breakdown. Stories are the individual tasks the Loop Engine decomposes your request into.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="stats-memory"]',
    popover: {
      title: "Memory Stats",
      description:
        "How many memories have been extracted, how many have been consolidated into summaries, and the total summary count.",
      side: "top",
      align: "start",
    },
  },
];
