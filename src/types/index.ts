export type AgentType = "claude" | "gemini";
export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "needs_input"
  | "finished"
  | "error";
export type KnowledgeType = "system_prompt" | "context_file" | "notes";

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  git_enabled: boolean;
}

export interface AgentSession {
  id: string;
  projectId: string;
  agentType: AgentType;
  status: AgentStatus;
  yoloMode: boolean;
  createdAt: string;
  label: string;
}

export interface AgentDefinition {
  agent_type: AgentType;
  display_name: string;
  command: string;
  default_args: string[];
  yolo_flag: string;
  detect_idle_pattern: string;
  detect_input_pattern: string;
  detect_finished_pattern: string;
  icon: string;
}

export interface KnowledgeEntry {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  content_type: KnowledgeType;
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
