import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import type {
  Project,
  AppSettings,
  AgentDefinition,
  Note,
  GitStatus,
  PersistedSession,
  ContextUnit,
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

export async function arbiterReview(
  prompt: string,
  projectPath: string,
  cliCommand?: string,
  model?: string,
): Promise<string> {
  return invoke("arbiter_review", { prompt, projectPath, cliCommand, model });
}

export async function listCliModels(cliCommand: string): Promise<string[]> {
  return invoke("list_cli_models", { cliCommand });
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

export async function listNotes(projectId: string): Promise<Note[]> {
  return invoke("list_notes", { projectId });
}

export async function createNote(
  projectId: string,
  title: string,
  content: string,
): Promise<Note> {
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

export async function setNoteContextToggle(
  projectId: string,
  noteId: string,
  include: boolean,
): Promise<void> {
  return invoke("set_note_context_toggle", { projectId, noteId, include });
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

export async function listContextUnits(projectId?: string): Promise<ContextUnit[]> {
  return invoke("list_context_units", { projectId: projectId ?? null });
}
export async function createContextUnit(unit: ContextUnit): Promise<void> {
  return invoke("create_context_unit", { unit });
}
export async function updateContextUnit(unit: ContextUnit): Promise<void> {
  return invoke("update_context_unit", { unit });
}
export async function deleteContextUnit(id: string): Promise<void> {
  return invoke("delete_context_unit", { id });
}
export async function searchContextUnits(query: string, projectId?: string): Promise<ContextUnit[]> {
  return invoke("search_context_units", { query, projectId: projectId ?? null });
}
export async function assignContext(unitId: string, sessionId: string): Promise<void> {
  return invoke("assign_context", { unitId, sessionId });
}
export async function unassignContext(unitId: string, sessionId: string): Promise<void> {
  return invoke("unassign_context", { unitId, sessionId });
}
export async function listSessionContext(sessionId: string): Promise<ContextUnit[]> {
  return invoke("list_session_context", { sessionId });
}
export async function setProjectDefaultContext(unitId: string, projectId: string): Promise<void> {
  return invoke("set_project_default_context", { unitId, projectId });
}
export async function removeProjectDefaultContext(unitId: string, projectId: string): Promise<void> {
  return invoke("remove_project_default_context", { unitId, projectId });
}
export async function listProjectDefaultContext(projectId: string): Promise<ContextUnit[]> {
  return invoke("list_project_default_context", { projectId });
}
export async function generateContextSummary(unitId: string, projectPath: string): Promise<void> {
  return invoke("generate_context_summary", { unitId, projectPath });
}
