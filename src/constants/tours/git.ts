import type { DriveStep } from "driver.js";

export const gitTour: DriveStep[] = [
  {
    element: '[data-tour="git-file-list"]',
    popover: {
      title: "File Changes",
      description:
        "See changed files and their status. Click a file to view its diff. Double-click to stage or unstage.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="git-diff"]',
    popover: {
      title: "Diff Viewer",
      description: "Review changes before committing. Shows line-by-line additions and deletions.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="git-commit"]',
    popover: {
      title: "Commit",
      description: "Stage files and create commits with a message.",
      side: "right",
      align: "end",
    },
  },
];
