export type BugProviderType = "jira" | "github_projects" | "youtrack";

export interface BugItem {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  labels: string[];
  url: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfig {
  provider: BugProviderType;
  project_key: string;
  base_url: string | null;
  board_id: string | null;
  client_id: string | null;
  client_secret: string | null;
}
