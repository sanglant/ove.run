import type { AgentStatus, AgentType } from "@/types";

export interface PatternEntry {
  pattern: RegExp;
  status: AgentStatus;
  label?: string;
}

/**
 * Strip ANSI escape codes from terminal output so pattern matching
 * works against the visible text content.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

export const AGENT_PATTERNS: Record<AgentType, PatternEntry[]> = {
  claude: [
    // needs_input — Claude Code CLI permission / input prompts
    {
      pattern: /\(y\/n\)/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /\[Y\/n\]|\[y\/N\]/,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Allow|Deny|approve|reject/i,
      status: "needs_input",
      label: "Waiting for permission",
    },
    {
      pattern: /Do you want to proceed|Do you want to continue/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /Press Enter to continue/i,
      status: "needs_input",
      label: "Waiting for enter",
    },
    {
      pattern: /Human:|❯\s*$/,
      status: "needs_input",
      label: "Waiting for input",
    },
    // working — active processing indicators
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
      pattern: /Reading|Writing|Editing|Searching/i,
      status: "working",
      label: "Working",
    },
    {
      pattern: /\$ |bash-/,
      status: "working",
      label: "Executing command",
    },
    // error
    {
      pattern: /Error:|ERROR:|error:|FATAL/,
      status: "error",
      label: "Error",
    },
    // finished
    {
      pattern: /Task complete|TASK COMPLETE|Done\.|Finished\./i,
      status: "finished",
      label: "Task complete",
    },
    // idle — prompt ready for input (lowest priority)
    {
      pattern: /claude>\s*$/i,
      status: "idle",
      label: "Idle",
    },
    {
      pattern: />\s*$/,
      status: "idle",
      label: "Idle",
    },
  ],
  gemini: [
    {
      pattern: /\(y\/n\)/i,
      status: "needs_input",
      label: "Waiting for confirmation",
    },
    {
      pattern: /\? .+/,
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
      pattern: /gemini>\s*$/i,
      status: "idle",
      label: "Idle",
    },
  ],
};

export function detectStatusFromOutput(
  agentType: AgentType,
  output: string,
): AgentStatus | null {
  const clean = stripAnsi(output);
  const patterns = AGENT_PATTERNS[agentType];
  for (const entry of patterns) {
    if (entry.pattern.test(clean)) {
      return entry.status;
    }
  }
  return null;
}
