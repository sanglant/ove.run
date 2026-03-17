import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { parseFeedbackOptions, cleanTerminalOutput, appendToTerminalBuffer } from "./feedbackParser";

describe("parseFeedbackOptions", () => {
  describe("empty / plain output", () => {
    it("returns a single Continue option with allowFreeInput=true for plain output", () => {
      const result = parseFeedbackOptions("Some random terminal output");
      expect(result.allowFreeInput).toBe(true);
      expect(result.options).toHaveLength(1);
      expect(result.options[0].label).toContain("Continue");
    });

    it("returns options for an empty string", () => {
      const result = parseFeedbackOptions("");
      expect(result.options).toHaveLength(1);
      expect(result.allowFreeInput).toBe(true);
    });
  });

  describe("[Y/n] — Yes is default", () => {
    it("returns Yes (default) and No options", () => {
      const result = parseFeedbackOptions("Do you want to continue? [Y/n]");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
      expect(result.options[0].label).toContain("Yes");
      expect(result.options[1].label).toContain("No");
    });

    it("sends CR (Enter) for the Yes default option", () => {
      const result = parseFeedbackOptions("Overwrite file? [Y/n]");
      // Enter = CR = 0x0d
      expect(result.options[0].keys).toContain(0x0d);
    });
  });

  describe("[y/N] — No is default", () => {
    it("returns Yes and No (default) options", () => {
      const result = parseFeedbackOptions("Are you sure? [y/N]");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
      expect(result.options[0].label).toBe("Yes");
      expect(result.options[1].label).toContain("No");
    });
  });

  describe("(y/n) generic", () => {
    it("returns Yes and No options for (y/n)", () => {
      const result = parseFeedbackOptions("Proceed? (y/n)");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
    });

    it("returns Yes and No options for (Y/N)", () => {
      const result = parseFeedbackOptions("Proceed? (Y/N)");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
    });
  });

  describe("Press Enter prompts", () => {
    it("returns a single Continue option for press enter", () => {
      const result = parseFeedbackOptions("Press Enter to continue...");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(1);
      expect(result.options[0].label).toBe("Continue");
    });
  });

  describe("Do you want to proceed/continue", () => {
    it("returns Yes and No for 'do you want to proceed'", () => {
      const result = parseFeedbackOptions("Do you want to proceed with this action?");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
    });

    it("returns Yes and No for 'do you want to continue'", () => {
      const result = parseFeedbackOptions("Do you want to continue?");
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
    });
  });

  describe("Human: prompt → free text", () => {
    it("returns empty options with allowFreeInput=true", () => {
      const result = parseFeedbackOptions("Some context\nHuman: ");
      expect(result.options).toHaveLength(0);
      expect(result.allowFreeInput).toBe(true);
    });
  });

  describe("Ink arrow-key selection menu", () => {
    it("detects a multi-item arrow menu and returns one option per item", () => {
      const output = [
        "? Do you want to allow edits to files?",
        "❯ 1. Yes",
        "  2. Yes, allow all edits during this session (shift+tab)",
        "  3. No",
      ].join("\n");

      const result = parseFeedbackOptions(output);
      expect(result.allowFreeInput).toBe(false);
      expect(result.options.length).toBeGreaterThanOrEqual(2);
    });

    it("strips ANSI codes before parsing the menu", () => {
      const withAnsi = "\x1b[32m❯\x1b[0m 1. Yes\n  2. No\n  3. Maybe";
      const result = parseFeedbackOptions(withAnsi);
      expect(result.allowFreeInput).toBe(false);
      expect(result.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("ANSI stripping", () => {
    it("strips ANSI codes before matching patterns", () => {
      const withAnsi = "\x1b[32mOverwrite?\x1b[0m [Y/n]";
      const result = parseFeedbackOptions(withAnsi);
      expect(result.allowFreeInput).toBe(false);
      expect(result.options).toHaveLength(2);
    });
  });
});

describe("cleanTerminalOutput", () => {
  it("trims leading and trailing whitespace", () => {
    expect(cleanTerminalOutput("  hello  ")).toBe("hello");
  });

  it("collapses 3+ consecutive blank lines to 2", () => {
    const raw = "line1\n\n\n\nline2";
    const result = cleanTerminalOutput(raw);
    expect(result).toBe("line1\n\nline2");
  });

  it("removes carriage returns", () => {
    const raw = "line1\r\nline2\r";
    const result = cleanTerminalOutput(raw);
    expect(result).not.toContain("\r");
  });

  it("does not collapse 2 consecutive blank lines", () => {
    const raw = "a\n\nb";
    expect(cleanTerminalOutput(raw)).toBe("a\n\nb");
  });

  it("returns empty string for blank input", () => {
    expect(cleanTerminalOutput("   \n\n   ")).toBe("");
  });
});

describe("appendToTerminalBuffer", () => {
  it("appends plain text to an empty buffer", () => {
    expect(appendToTerminalBuffer("", "hello")).toBe("hello");
  });

  it("handles \\n as a new line", () => {
    const result = appendToTerminalBuffer("", "line1\nline2");
    expect(result).toBe("line1\nline2");
  });

  it("treats \\r\\n as a single newline", () => {
    const result = appendToTerminalBuffer("", "line1\r\nline2");
    expect(result).toBe("line1\nline2");
  });

  it("standalone \\r clears the current line (spinner overwrite)", () => {
    const result = appendToTerminalBuffer("", "spinner\rnew");
    expect(result).toBe("new");
  });

  it("preserves ANSI escape sequences inline", () => {
    const chunk = "\x1b[32mgreen\x1b[0m";
    const result = appendToTerminalBuffer("", chunk);
    expect(result).toBe(chunk);
  });
});
