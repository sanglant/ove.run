import type { AgentStatus } from "@/types";

export interface AgentMeta {
  label: string;
  color: string;
  displayName: string;
}

export interface StatusMeta {
  label: string;
  color: string;
  className?: string;
}

export const AGENT_META: Record<string, AgentMeta> = {
  claude:   { label: "CC", color: "var(--claude)",         displayName: "Claude" },
  gemini:   { label: "GC", color: "var(--gemini)",         displayName: "Gemini" },
  copilot:  { label: "CP", color: "var(--copilot)",        displayName: "Copilot" },
  codex:    { label: "CX", color: "var(--codex)",          displayName: "Codex" },
  terminal: { label: ">_", color: "var(--text-secondary)", displayName: "Terminal" },
};

export const STATUS_META: Record<string, StatusMeta> = {
  starting:    { label: "Starting",    color: "var(--warning)" },
  idle:        { label: "Idle",        color: "var(--text-secondary)" },
  working:     { label: "Working",     color: "var(--accent)" },
  needs_input: { label: "Needs Input", color: "var(--warning)",  className: "animate-status-pulse" },
  finished:    { label: "Finished",    color: "var(--success)" },
  error:       { label: "Error",       color: "var(--danger)" },
};

/** Ordered for display in status bar */
export const STATUS_ORDER: AgentStatus[] = [
  "working",
  "needs_input",
  "starting",
  "idle",
  "error",
  "finished",
];

export function getAgentMeta(agentType: string): AgentMeta {
  return AGENT_META[agentType] ?? { label: "?", color: "var(--text-secondary)", displayName: agentType };
}

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, color: "var(--text-secondary)" };
}
