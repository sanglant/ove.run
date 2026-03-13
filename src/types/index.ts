export type AgentType = "claude" | "gemini" | "copilot" | "codex" | "terminal";
export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "needs_input"
  | "finished"
  | "error";
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

export interface GlobalSettings {
  theme: string;
  font_family: string;
  font_size: number;
  notifications_enabled: boolean;
  minimize_to_tray: boolean;
  terminal_scrollback: number;
  arbiter_timeout_seconds: number;
  arbiter_provider: string;
  arbiter_model: string;
}

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
}

export interface ContextAssignment {
  context_unit_id: string;
  session_id: string;
  assigned_at: string;
}
