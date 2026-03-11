import type { DriveStep } from "driver.js";
import { terminalTour } from "./terminal";
import { gitTour } from "./git";
import { knowledgeTour } from "./knowledge";
import { notesTour } from "./notes";
import { bugsTour } from "./bugs";

export { homeTour } from "./home";
export { terminalTour } from "./terminal";
export { gitTour } from "./git";
export { knowledgeTour } from "./knowledge";
export { notesTour } from "./notes";
export { bugsTour } from "./bugs";
export {
  jiraSetupTour,
  githubSetupTour,
  youtrackSetupTour,
  genericSetupTour,
} from "./bugSetup";

export const panelTours: Record<string, DriveStep[]> = {
  terminal: terminalTour,
  git: gitTour,
  knowledge: knowledgeTour,
  notes: notesTour,
  bugs: bugsTour,
};
