import type { ParsedOption } from "@/types";
import { toBytes } from "@/lib/pty-utils";
import { stripAnsi } from "@/lib/patterns";

interface ParseResult {
  options: ParsedOption[];
  allowFreeInput: boolean;
}

// Matches a single ANSI escape sequence at position i in a string.
// Returns the length of the sequence, or 0 if not an escape sequence.
function ansiSeqLength(str: string, i: number): number {
  if (str[i] !== "\x1b") return 0;
  const next = str[i + 1];
  if (next === "[") {
    // CSI sequence: ESC [ ... <letter>
    let j = i + 2;
    while (j < str.length && str.charCodeAt(j) >= 0x20 && str.charCodeAt(j) <= 0x3f) j++;
    if (j < str.length && str.charCodeAt(j) >= 0x40 && str.charCodeAt(j) <= 0x7e) j++;
    return j - i;
  }
  if (next === "]") {
    // OSC sequence: ESC ] ... (terminated by BEL or ST)
    let j = i + 2;
    while (j < str.length) {
      if (str[j] === "\x07") return j + 1 - i;
      if (str[j] === "\x1b" && j + 1 < str.length && str[j + 1] === "\\") return j + 2 - i;
      j++;
    }
    return j - i;
  }
  // Two-char escape (e.g. ESC ( B)
  if (next) return 2;
  return 1;
}

/**
 * Simulate a terminal line buffer: process each character in `chunk`,
 * respecting \r (carriage return → reset current line) and \n (new line).
 * ANSI escape sequences are preserved (passed through to current line).
 * Other control characters (BEL, etc.) are silently dropped.
 */
export function appendToTerminalBuffer(buffer: string, chunk: string): string {
  const lines = buffer.split("\n");
  let currentLine = lines.pop() ?? "";
  let startIdx = 0;

  // Handle pending \r from previous chunk (stored as trailing \r on currentLine).
  // We deferred the decision — now we know what follows.
  if (currentLine.endsWith("\r")) {
    currentLine = currentLine.slice(0, -1);
    if (chunk[0] === "\n") {
      // Was \r\n split across chunks — treat as line ending
      lines.push(currentLine);
      currentLine = "";
      startIdx = 1;
    } else {
      // Standalone \r — spinner overwrite, clear the line
      currentLine = "";
    }
  }

  for (let i = startIdx; i < chunk.length; i++) {
    const char = chunk[i];

    // Pass through ANSI escape sequences as-is
    const seqLen = ansiSeqLength(chunk, i);
    if (seqLen > 0) {
      currentLine += chunk.slice(i, i + seqLen);
      i += seqLen - 1;
      continue;
    }

    if (char === "\r") {
      if (chunk[i + 1] === "\n") {
        // \r\n in same chunk — standard line ending
        lines.push(currentLine);
        currentLine = "";
        i++; // skip the \n
      } else if (i === chunk.length - 1) {
        // \r at end of chunk — defer decision, store as sentinel
        currentLine += "\r";
      } else {
        // Standalone \r mid-chunk — spinner overwrite, clear line
        currentLine = "";
      }
    } else if (char === "\n") {
      lines.push(currentLine);
      currentLine = "";
    } else if (char.charCodeAt(0) >= 32 || char === "\t") {
      currentLine += char;
    }
    // skip all other control chars (BEL, etc.)
  }
  lines.push(currentLine);

  return lines.join("\n");
}

/**
 * Cosmetic pass for final display: collapse excessive blank lines and trim.
 */
export function cleanTerminalOutput(raw: string): string {
  // Strip any pending \r sentinel left by appendToTerminalBuffer
  let cleaned = raw.replace(/\r/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.trim();
  return cleaned;
}


// Arrow key escape sequences for navigating Ink SelectInput menus
const ARROW_DOWN = [0x1b, 0x5b, 0x42]; // ESC [ B
const ENTER = [0x0d]; // CR

/**
 * Build key sequence: N arrow-downs then Enter.
 */
function arrowSelect(downs: number): number[] {
  const keys: number[] = [];
  for (let i = 0; i < downs; i++) {
    keys.push(...ARROW_DOWN);
  }
  keys.push(...ENTER);
  return keys;
}

/**
 * Detect Ink-style arrow-key selection menus.
 * Format: ❯ marks the currently selected item; other items are indented.
 *
 * Example:
 *   ❯ 1. Yes
 *     2. Yes, allow all edits during this session (shift+tab)
 *     3. No
 *
 * Returns the menu items with arrow-key sequences to select each one,
 * or null if no menu is detected.
 */
function parseArrowMenu(text: string): ParseResult | null {
  // Look for lines with ❯ indicator followed by numbered or plain items
  // The ❯ item is at index 0 (already selected); items below need arrow-downs.
  const lines = text.split("\n");

  // Find the line with ❯ — scan from the end (most recent render)
  let menuStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/❯/.test(lines[i])) {
      menuStart = i;
      break;
    }
  }
  if (menuStart === -1) return null;

  // Collect menu items: the ❯ line and consecutive indented lines after it
  const items: string[] = [];
  // Extract label from the ❯ line
  const arrowIdx = lines[menuStart].indexOf("❯");
  if (arrowIdx === -1) return null;
  const firstLabel = lines[menuStart]
    .slice(arrowIdx + 1)
    .replace(/^\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();
  if (!firstLabel) return null;
  items.push(firstLabel);

  // Collect subsequent indented lines (non-empty, no ❯)
  for (let i = menuStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    // Stop at hint lines like "Esc to cancel"
    if (/^esc\b/i.test(line) || /^tab\b/i.test(line)) break;
    const label = line.replace(/^\d+\.\s*/, "").trim();
    if (label) items.push(label);
  }

  if (items.length < 2) return null;

  const options = items.map((label, idx) => ({
    label,
    keys: arrowSelect(idx), // 0 downs for first (already selected), 1 for second, etc.
  }));

  return { options, allowFreeInput: false };
}

export function parseFeedbackOptions(output: string): ParseResult {
  // Strip ANSI codes, then trim trailing spaces per line (Claude Code / Ink pads
  // every line to full terminal width; without per-line trim, 500 chars ≈ 4 lines).
  const stripped = stripAnsi(output);
  const trimmed = stripped.split("\n").map((l) => l.trimEnd()).join("\n").trim();
  const lastChunk = trimmed.slice(-500);

  // 1. Ink-style arrow-key selection menu (Claude Code permission prompts)
  const arrowMenu = parseArrowMenu(lastChunk);
  if (arrowMenu) return arrowMenu;

  // 2. Human: prompt → free text only
  if (/Human:\s*$/.test(lastChunk)) {
    return { options: [], allowFreeInput: true };
  }

  // 3. [Y/n] — Yes is default (Enter), No needs explicit 'n'
  if (/\[Y\/n\]/i.test(lastChunk) && !/\[y\/N\]/.test(lastChunk)) {
    return {
      options: [
        { label: "Yes (default)", keys: toBytes("\r") },
        { label: "No", keys: toBytes("n\r") },
      ],
      allowFreeInput: false,
    };
  }

  // 4. [y/N] — No is default (Enter), Yes needs explicit 'y'
  if (/\[y\/N\]/.test(lastChunk)) {
    return {
      options: [
        { label: "Yes", keys: toBytes("y\r") },
        { label: "No (default)", keys: toBytes("\r") },
      ],
      allowFreeInput: false,
    };
  }

  // 5. Generic (y/n) or (Y/N)
  if (/\(y\/n\)/i.test(lastChunk)) {
    return {
      options: [
        { label: "Yes", keys: toBytes("y\r") },
        { label: "No", keys: toBytes("n\r") },
      ],
      allowFreeInput: false,
    };
  }

  // 6. "Press Enter" / "press enter to continue"
  if (/press\s+enter/i.test(lastChunk)) {
    return {
      options: [
        { label: "Continue", keys: toBytes("\r") },
      ],
      allowFreeInput: false,
    };
  }

  // 7. "Do you want to proceed/continue"
  if (/do you want to (?:proceed|continue)/i.test(lastChunk)) {
    return {
      options: [
        { label: "Yes", keys: toBytes("y\r") },
        { label: "No", keys: toBytes("n\r") },
      ],
      allowFreeInput: false,
    };
  }

  // 8. Fallback: offer free input and a generic Enter
  return {
    options: [
      { label: "Continue (Enter)", keys: toBytes("\r") },
    ],
    allowFreeInput: true,
  };
}
