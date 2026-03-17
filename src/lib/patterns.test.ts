import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { detectStatusFromOutput, stripAnsi } from "./patterns";
import type { AgentDefinition } from "@/types";

function makeAgentDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    agent_type: "claude",
    display_name: "Claude",
    command: "claude",
    default_args: [],
    yolo_flag: "--dangerously-skip-permissions",
    resume_args: ["--resume"],
    detect_idle_pattern: "\\$",
    detect_input_pattern: "\\?",
    detect_finished_pattern: "DONE",
    icon: "",
    ...overrides,
  };
}

describe("stripAnsi", () => {
  it("strips CSI sequences (e.g. color codes)", () => {
    expect(stripAnsi("\x1b[32mgreen\x1b[0m")).toBe("green");
  });

  it("returns plain text unchanged", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("strips multiple sequences from one string", () => {
    const raw = "\x1b[1mbold\x1b[0m and \x1b[33myellow\x1b[0m";
    expect(stripAnsi(raw)).toBe("bold and yellow");
  });

  it("returns empty string for empty input", () => {
    expect(stripAnsi("")).toBe("");
  });
});

describe("detectStatusFromOutput", () => {
  it("returns null when agentDef is null", () => {
    expect(detectStatusFromOutput(null, "some output")).toBeNull();
  });

  it("returns null when no pattern matches", () => {
    const def = makeAgentDef({
      detect_idle_pattern: "IDLE_SENTINEL",
      detect_input_pattern: "INPUT_SENTINEL",
      detect_finished_pattern: "FINISHED_SENTINEL",
    });
    expect(detectStatusFromOutput(def, "completely unrelated output")).toBeNull();
  });

  it("returns needs_input when detect_input_pattern matches", () => {
    const def = makeAgentDef({ detect_input_pattern: "continue\\?" });
    const result = detectStatusFromOutput(def, "Do you want to continue?");
    expect(result).toBe("needs_input");
  });

  it("returns finished when detect_finished_pattern matches (and input pattern does not)", () => {
    const def = makeAgentDef({
      detect_input_pattern: "INPUT_ONLY",
      detect_finished_pattern: "Task completed",
    });
    const result = detectStatusFromOutput(def, "Task completed successfully.");
    expect(result).toBe("finished");
  });

  it("returns idle when detect_idle_pattern matches (and others do not)", () => {
    const def = makeAgentDef({
      detect_input_pattern: "INPUT_ONLY",
      detect_finished_pattern: "DONE_ONLY",
      detect_idle_pattern: "\\$",
    });
    const result = detectStatusFromOutput(def, "user@host:~$");
    expect(result).toBe("idle");
  });

  it("prefers needs_input over finished and idle when multiple match", () => {
    // All three patterns match the same output; priority should be needs_input.
    const def = makeAgentDef({
      detect_input_pattern: "match",
      detect_finished_pattern: "match",
      detect_idle_pattern: "match",
    });
    expect(detectStatusFromOutput(def, "match")).toBe("needs_input");
  });

  it("prefers finished over idle when input pattern does not match", () => {
    const def = makeAgentDef({
      detect_input_pattern: "INPUT_ONLY",
      detect_finished_pattern: "match",
      detect_idle_pattern: "match",
    });
    expect(detectStatusFromOutput(def, "match")).toBe("finished");
  });

  it("strips ANSI codes before matching patterns", () => {
    const def = makeAgentDef({ detect_input_pattern: "question" });
    const result = detectStatusFromOutput(def, "\x1b[31mquestion\x1b[0m");
    expect(result).toBe("needs_input");
  });

  it("handles case-insensitive patterns prefixed with (?i)", () => {
    const def = makeAgentDef({ detect_input_pattern: "(?i)WAITING" });
    const result = detectStatusFromOutput(def, "waiting for input");
    expect(result).toBe("needs_input");
  });

  it("handles an invalid regex pattern gracefully (returns null)", () => {
    const def = makeAgentDef({ detect_input_pattern: "[invalid" });
    expect(detectStatusFromOutput(def, "some output")).toBeNull();
  });

  it("does not throw when all pattern fields are empty strings", () => {
    const def = makeAgentDef({
      detect_input_pattern: "",
      detect_finished_pattern: "",
      detect_idle_pattern: "",
    });
    expect(() => detectStatusFromOutput(def, "output")).not.toThrow();
  });
});
