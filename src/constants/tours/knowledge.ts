import type { DriveStep } from "driver.js";

export const knowledgeTour: DriveStep[] = [
  {
    element: '[data-tour="knowledge-file-list"]',
    popover: {
      title: "Context Entries",
      description:
        "Manage context files loaded into agent sessions. Organized by type: system prompts, context files, and notes.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="knowledge-editor"]',
    popover: {
      title: "Editor",
      description: "Edit system prompts and context documents in a markdown workspace.",
      side: "left",
      align: "start",
    },
  },
];
