import type { DriveStep } from "driver.js";

export const notesTour: DriveStep[] = [
  {
    element: '[data-tour="notes-list"]',
    popover: {
      title: "Notes List",
      description: "Organize notes per project. Create, browse, and delete markdown documents.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="notes-editor"]',
    popover: {
      title: "Editor",
      description: "Rich text editor with markdown support for writing and formatting notes.",
      side: "left",
      align: "start",
    },
  },
];
