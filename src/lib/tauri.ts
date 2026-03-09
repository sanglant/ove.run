import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import type {
  Project,
  AppSettings,
  AgentDefinition,
  KnowledgeEntry,
  ProjectNote,
  GitStatus,
  KnowledgeType,
  PersistedSession,
} from "@/types";
import type { BugItem, ProviderConfig } from "../features/bugs/types";

export { listen, emit };

export async function spawnPty(
  sessionId: string,
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("spawn_pty", { sessionId, command, args, cwd, env, cols, rows });
}

export async function writePty(sessionId: string, data: number[]): Promise<void> {
  return invoke("write_pty", { sessionId, data });
}

export async function resizePty(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("resize_pty", { sessionId, cols, rows });
}

export async function killPty(sessionId: string): Promise<void> {
  return invoke("kill_pty", { sessionId });
}

export async function gitStatus(path: string): Promise<GitStatus> {
  return invoke("git_status", { path });
}

export async function gitDiff(path: string, staged: boolean): Promise<string> {
  return invoke("git_diff", { path, staged });
}

export async function gitDiffFile(
  path: string,
  filePath: string,
  staged: boolean,
): Promise<string> {
  return invoke("git_diff_file", { path, filePath, staged });
}

export async function gitStage(path: string, files: string[]): Promise<void> {
  return invoke("git_stage", { path, files });
}

export async function gitUnstage(path: string, files: string[]): Promise<void> {
  return invoke("git_unstage", { path, files });
}

export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke("git_commit", { path, message });
}

export async function listProjects(): Promise<Project[]> {
  return invoke("list_projects");
}

export async function addProject(name: string, path: string): Promise<Project> {
  return invoke("add_project", { name, path });
}

export async function removeProject(id: string): Promise<void> {
  return invoke("remove_project", { id });
}

export async function updateProject(project: Project): Promise<void> {
  return invoke("update_project", { updatedProject: project });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  return invoke("update_settings", { settings });
}

export async function listAgentTypes(): Promise<AgentDefinition[]> {
  return invoke("list_agent_types");
}

export async function listKnowledge(projectId: string): Promise<KnowledgeEntry[]> {
  return invoke("list_knowledge", { projectId });
}

export async function createKnowledge(
  projectId: string,
  name: string,
  contentType: KnowledgeType,
  content: string,
): Promise<KnowledgeEntry> {
  return invoke("create_knowledge", { projectId, name, contentType, content });
}

export async function readKnowledgeContent(
  projectId: string,
  knowledgeId: string,
): Promise<string> {
  return invoke("read_knowledge_content", { projectId, knowledgeId });
}

export async function updateKnowledge(
  projectId: string,
  knowledgeId: string,
  content: string,
): Promise<void> {
  return invoke("update_knowledge", { projectId, knowledgeId, content });
}

export async function deleteKnowledge(
  projectId: string,
  knowledgeId: string,
): Promise<void> {
  return invoke("delete_knowledge", { projectId, knowledgeId });
}

export async function guardianReview(prompt: string, projectPath: string): Promise<string> {
  return invoke("guardian_review", { prompt, projectPath });
}

export async function saveSessions(sessions: PersistedSession[]): Promise<void> {
  return invoke("save_sessions", { sessions });
}

export async function loadSessions(): Promise<PersistedSession[]> {
  return invoke("load_sessions");
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  return invoke("send_desktop_notification", { title, body });
}

export async function listNotes(projectId: string): Promise<ProjectNote[]> {
  return invoke("list_notes", { projectId });
}

export async function createNote(
  projectId: string,
  title: string,
  content: string,
): Promise<ProjectNote> {
  return invoke("create_note", { projectId, title, content });
}

export async function readNoteContent(
  projectId: string,
  noteId: string,
): Promise<string> {
  return invoke("read_note_content", { projectId, noteId });
}

export async function updateNote(
  projectId: string,
  noteId: string,
  title: string,
  content: string,
): Promise<void> {
  return invoke("update_note", { projectId, noteId, title, content });
}

export async function deleteNote(
  projectId: string,
  noteId: string,
): Promise<void> {
  return invoke("delete_note", { projectId, noteId });
}

export async function getBugProviderConfig(projectId: string): Promise<ProviderConfig | null> {
  return invoke("get_bug_provider_config", { projectId });
}

export async function saveBugProviderConfig(projectId: string, config: ProviderConfig): Promise<void> {
  return invoke("save_bug_provider_config", { projectId, config });
}

export async function startBugOauth(projectId: string): Promise<{ auth_url: string; port: number }> {
  return invoke("start_bug_oauth", { projectId });
}

export async function checkBugAuth(projectId: string): Promise<boolean> {
  return invoke("check_bug_auth", { projectId });
}

export async function listBugs(projectId: string): Promise<BugItem[]> {
  return invoke("list_bugs", { projectId });
}

export async function getBugDetail(projectId: string, bugId: string): Promise<BugItem> {
  return invoke("get_bug_detail", { projectId, bugId });
}

export async function disconnectBugProvider(projectId: string): Promise<void> {
  return invoke("disconnect_bug_provider", { projectId });
}
