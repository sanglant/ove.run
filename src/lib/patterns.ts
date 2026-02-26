import type { AgentStatus, AgentType } from "@/types";

export interface PatternEntry {
  pattern: RegExp;
  status: AgentStatus;
  label?: string;
}

export const AGENT_PATTERNS: Record<AgentType, PatternEntry[]> = {
  claude: [
    {
      pattern: /Human:|human:/,
      status: "needs_input",
      label: "Waiting for input",
    },
    {
      pattern: /\? Do you want to proceed/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Press Enter to continue/i,
      status: "needs_input",
      label: "Waiting for enter",
    },
    {
      pattern: /ToolUseBlock|tool_use|<tool_call>/i,
      status: "working",
      label: "Using tool",
    },
    {
      pattern: /Thinking\.\.\.|thinking\.\.\./,
      status: "working",
      label: "Thinking",
    },
    {
      pattern: /Running\s+/i,
      status: "working",
      label: "Running",
    },
    {
      pattern: /\$ |> |bash-/,
      status: "working",
      label: "Executing command",
    },
    {
      pattern: /Error:|ERROR:|error:/,
      status: "error",
      label: "Error",
    },
    {
      pattern: /Task complete|TASK COMPLETE|Done\.|Finished\./i,
      status: "finished",
      label: "Task complete",
    },
    {
      pattern: /claude>/i,
      status: "idle",
      label: "Idle",
    },
  ],
  gemini: [
    {
      pattern: /\? /,
      status: "needs_input",
      label: "Waiting for input",
    },
    {
      pattern: /Press Enter/i,
      status: "needs_input",
      label: "Waiting for enter",
    },
    {
      pattern: /Executing code|Calling function|Running tool/i,
      status: "working",
      label: "Executing",
    },
    {
      pattern: /Generating\.\.\.|Thinking\.\.\./i,
      status: "working",
      label: "Generating",
    },
    {
      pattern: /Error:|ERROR:/,
      status: "error",
      label: "Error",
    },
    {
      pattern: /Done\.|Complete\.|Finished\./i,
      status: "finished",
      label: "Done",
    },
    {
      pattern: /gemini>/i,
      status: "idle",
      label: "Idle",
    },
  ],
};

export function detectStatusFromOutput(
  agentType: AgentType,
  output: string,
): AgentStatus | null {
  const patterns = AGENT_PATTERNS[agentType];
  for (const entry of patterns) {
    if (entry.pattern.test(output)) {
      return entry.status;
    }
  }
  return null;
}
