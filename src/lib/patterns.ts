import type { AgentStatus, AgentDefinition } from "@/types";

/**
 * Strip ANSI escape codes from terminal output so pattern matching
 * works against the visible text content.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/**
 * Convert a Rust-style regex pattern to a JavaScript RegExp.
 * Strips (?i) inline flags and converts them to the JS 'i' flag.
 */
const regexCache = new Map<string, RegExp | null>();

function toJsRegExp(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;

  let flags = "";
  let source = pattern;

  // Rust patterns use (?i) for case-insensitive; JS needs the 'i' flag instead
  if (source.startsWith("(?i)")) {
    if (!flags.includes("i")) flags += "i";
    source = source.slice(4);
  }
  // Also handle (?i) anywhere in the pattern
  source = source.replace(/\(\?i\)/g, () => {
    if (!flags.includes("i")) flags += "i";
    return "";
  });

  let result: RegExp | null;
  try {
    result = new RegExp(source, flags);
  } catch {
    result = null;
  }
  regexCache.set(pattern, result);
  return result;
}

/**
 * Detect agent status from terminal output using the patterns defined
 * in the agent definition (from the Rust backend registry).
 *
 * Tests the last 500 visible chars against detect_input_pattern,
 * detect_finished_pattern, and detect_idle_pattern (in that priority order).
 */
export function detectStatusFromOutput(
  agentDef: AgentDefinition | null,
  output: string,
): AgentStatus | null {
  if (!agentDef) return null;

  const clean = stripAnsi(output);
  // Claude Code (Ink) pads every line with spaces to full terminal width (~130 chars).
  // Without trimming, 500 chars only covers ~4 lines and the question text is missed.
  // Trimming trailing spaces per line collapses padding so 500 chars covers 20+ lines.
  const trimmed = clean.split("\n").map((l) => l.trimEnd()).join("\n");
  const tail = trimmed.slice(-500);

  // Priority order: needs_input > finished > idle
  // These use the regex patterns defined per-agent in the Rust registry.
  if (agentDef.detect_input_pattern) {
    const re = toJsRegExp(agentDef.detect_input_pattern);
    if (re?.test(tail)) return "needs_input";
  }

  if (agentDef.detect_finished_pattern) {
    const re = toJsRegExp(agentDef.detect_finished_pattern);
    if (re?.test(tail)) return "finished";
  }

  if (agentDef.detect_idle_pattern) {
    const re = toJsRegExp(agentDef.detect_idle_pattern);
    if (re?.test(tail)) return "idle";
  }

  return null;
}
