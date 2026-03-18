import type { DriveStep } from "driver.js";
import { terminalTour } from "./terminal";
import { gitTour } from "./git";
import { knowledgeTour } from "./knowledge";
import { notesTour } from "./notes";
import { bugsTour } from "./bugs";
import { memoryTour } from "./memory";
import { statsTour } from "./stats";

export { homeTour } from "./home";
export { terminalTour } from "./terminal";
export { gitTour } from "./git";
export { knowledgeTour } from "./knowledge";
export { notesTour } from "./notes";
export { bugsTour } from "./bugs";
export { memoryTour } from "./memory";
export { statsTour } from "./stats";
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
  memory: memoryTour,
  stats: statsTour,
};
