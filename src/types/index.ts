// Re-export auto-generated types from Rust (via ts-rs).
// Types not listed here either have no Rust counterpart or differ from the
// generated shape (e.g. TrustLevel uses numeric keys on the frontend;
// AgentSettings.env_vars keeps Record<string,string> rather than optional values).
export type { AgentType, AgentStatus, GlobalSettings, Consolidation, QualityGateConfig } from "./generated";

// Import for local use within this file (re-exports alone don't bring names into scope).
import type { AgentType, AgentStatus, GlobalSettings } from "./generated";

export type TerminalLayoutMode = "single" | "grid";
export type TerminalSplitFlow = "row" | "column";
export type TerminalPaneDropZone = "center" | "top" | "right" | "bottom" | "left";

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  git_enabled: boolean;
  arbiter_enabled: boolean;
  arbiter_agent_type?: AgentType;
}

export interface AgentSession {
  id: string;
  projectId: string;
  agentType: AgentType;
  status: AgentStatus;
  yoloMode: boolean;
  createdAt: string;
  label: string;
  isResumed: boolean;
  initialPrompt?: string;
  sandboxed?: boolean;
  arbiterEnabled?: boolean;
  maxIterations?: number;
}

export interface TerminalPaneLayoutNode {
  type: "pane";
  id: string;
  sessionId: string | null;
}

export interface TerminalSplitLayoutNode {
  type: "split";
  id: string;
  flow: TerminalSplitFlow;
  ratio: number;
  first: TerminalLayoutNode;
  second: TerminalLayoutNode;
}

export type TerminalLayoutNode = TerminalPaneLayoutNode | TerminalSplitLayoutNode;

export interface TerminalProjectLayout {
  mode: TerminalLayoutMode;
  root: TerminalLayoutNode;
  activePaneId: string;
}

export interface AgentDefinition {
  agent_type: AgentType;
  display_name: string;
  command: string;
  default_args: string[];
  yolo_flag: string;
  resume_args: string[];
  detect_idle_pattern: string;
  detect_input_pattern: string;
  detect_finished_pattern: string;
  icon: string;
}

export interface PersistedSession {
  id: string;
  project_id: string;
  agent_type: AgentType;
  yolo_mode: boolean;
  label: string;
  created_at: string;
  initial_prompt?: string;
}

export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;
  include_in_context: boolean;
  created_at: string;
  updated_at: string;
}

// AgentSettings and AppSettings are kept as manual definitions rather than
// using the generated types because ts-rs emits env_vars as { [key in string]?: string }
// (optional values), while the frontend relies on Record<string, string> throughout.
export interface AgentSettings {
  default_yolo_mode: boolean;
  custom_args: string[];
  env_vars: Record<string, string>;
}

export interface AppSettings {
  global: GlobalSettings;
  agents: Record<string, AgentSettings>;
}

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatus {
  is_repo: boolean;
  branch: string;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  sessionId: string;
  timestamp: string;
  read: boolean;
}

export type ToastLevel = "error" | "warning" | "success" | "info";

export interface ToastItem {
  id: string;
  level: ToastLevel;
  title: string;
  body?: string;
  duration?: number;
}

export interface ParsedOption {
  label: string;
  keys: number[];
}

export interface FeedbackItem {
  id: string;
  sessionId: string;
  projectId: string;
  type: "question" | "response";
  output: string;
  parsedOptions: ParsedOption[];
  allowFreeInput: boolean;
  timestamp: string;
  arbiterEnabled: boolean;
}

export type ContextUnitType = "persona" | "skill" | "knowledge" | "reference";
export type ContextScope = "global" | "project";

export interface ContextUnit {
  id: string;
  project_id: string | null;
  name: string;
  type: ContextUnitType;
  scope: ContextScope;
  tags_json: string;
  l0_summary: string | null;
  l1_overview: string | null;
  l2_content: string | null;
  created_at: string;
  updated_at: string;
  is_bundled: boolean;
  bundled_slug: string | null;
}

export interface ContextAssignment {
  context_unit_id: string;
  session_id: string;
  assigned_at: string;
}

export interface Memory {
  id: string;
  project_id: string;
  session_id: string | null;
  visibility: "private" | "public";
  content: string;
  summary: string | null;
  entities_json: string;
  topics_json: string;
  importance: number;
  consolidated: boolean;
  created_at: string;
}

export type TrustLevel = 1 | 2 | 3;
export type LoopStatus = "idle" | "planning" | "running" | "paused" | "completed" | "failed";
export type StoryStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface ArbiterState {
  project_id: string;
  trust_level: TrustLevel;
  loop_status: LoopStatus;
  current_story_id: string | null;
  iteration_count: number;
  max_iterations: number;
  last_activity_at: string | null;
}

export interface Story {
  id: string;
  project_id: string;
  title: string;
  description: string;
  acceptance_criteria: string | null;
  priority: number;
  status: StoryStatus;
  depends_on_json: string;
  iteration_attempts: number;
  created_at: string;
}

export const TRUST_LEVEL_LABELS: Record<TrustLevel, { name: string; description: string }> = {
  1: { name: "Supervised", description: "I'll approve each step" },
  2: { name: "Autonomous", description: "Run it, ask me when stuck" },
  3: { name: "Full Auto", description: "Handle everything" },
};

export interface GateResult {
  name: string;
  passed: boolean;
  output: string;
}

export type LoopEventType =
  | { type: "StatusChanged"; status: LoopStatus }
  | { type: "StoriesUpdated"; project_id: string }
  | { type: "StoryStarted"; story_id: string }
  | { type: "StoryCompleted"; story_id: string }
  | { type: "StoryFailed"; story_id: string; reason: string }
  | { type: "IterationCompleted"; count: number; max: number }
  | { type: "GateResult"; story_id: string; gate: string; passed: boolean; output: string }
  | { type: "CircuitBreakerTriggered"; reason: string }
  | { type: "LoopCompleted" }
  | { type: "LoopFailed"; reason: string }
  | { type: "ReasoningEntry"; action: string; reasoning: string };
