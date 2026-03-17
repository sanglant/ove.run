import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { collectPanes, countPanes, findPaneById } from "./layout";
import type { TerminalLayoutNode, TerminalPaneLayoutNode, TerminalSplitLayoutNode } from "@/types";

function pane(id: string, sessionId: string | null = null): TerminalPaneLayoutNode {
  return { type: "pane", id, sessionId };
}

function split(
  id: string,
  first: TerminalLayoutNode,
  second: TerminalLayoutNode,
): TerminalSplitLayoutNode {
  return { type: "split", id, flow: "row", ratio: 0.5, first, second };
}

describe("collectPanes", () => {
  it("returns a single-element array for a lone pane node", () => {
    const result = collectPanes(pane("p1", "s1"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("collects both leaf panes from a two-pane split", () => {
    const tree = split("sp1", pane("p1", "s1"), pane("p2", "s2"));
    const result = collectPanes(tree);
    expect(result).toHaveLength(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
  });

  it("collects all panes from a deeply nested tree", () => {
    const tree = split(
      "sp-root",
      split("sp-left", pane("p1"), pane("p2")),
      pane("p3"),
    );
    const result = collectPanes(tree);
    expect(result).toHaveLength(3);
  });

  it("accepts an initial panes array and appends to it", () => {
    const existing: TerminalPaneLayoutNode[] = [pane("pre-existing")];
    const result = collectPanes(pane("p1"), existing);
    expect(result).toHaveLength(2);
  });

  it("returns an empty-session pane correctly", () => {
    const result = collectPanes(pane("p1", null));
    expect(result[0].sessionId).toBeNull();
  });
});

describe("countPanes", () => {
  it("counts 1 for a single pane node", () => {
    expect(countPanes(pane("p1"))).toBe(1);
  });

  it("counts 2 for a direct split of two panes", () => {
    expect(countPanes(split("sp1", pane("p1"), pane("p2")))).toBe(2);
  });

  it("counts 4 for a 2-level balanced tree", () => {
    const tree = split(
      "root",
      split("left", pane("p1"), pane("p2")),
      split("right", pane("p3"), pane("p4")),
    );
    expect(countPanes(tree)).toBe(4);
  });

  it("counts an asymmetric tree correctly", () => {
    const tree = split(
      "root",
      split("left", pane("p1"), pane("p2")),
      pane("p3"),
    );
    expect(countPanes(tree)).toBe(3);
  });
});

describe("findPaneById", () => {
  it("returns the pane when the root node matches the id", () => {
    const result = findPaneById(pane("p1", "s1"), "p1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("p1");
    expect(result?.sessionId).toBe("s1");
  });

  it("returns null when the id is not found", () => {
    expect(findPaneById(pane("p1"), "unknown")).toBeNull();
  });

  it("finds a pane in the left branch of a split", () => {
    const tree = split("sp1", pane("p1", "s1"), pane("p2", "s2"));
    const result = findPaneById(tree, "p1");
    expect(result?.sessionId).toBe("s1");
  });

  it("finds a pane in the right branch of a split", () => {
    const tree = split("sp1", pane("p1"), pane("p2", "s2"));
    const result = findPaneById(tree, "p2");
    expect(result?.sessionId).toBe("s2");
  });

  it("finds a pane deep in a nested tree", () => {
    const tree = split(
      "root",
      split("left", pane("p1"), pane("p2")),
      split("right", pane("p3"), pane("p4", "deep-session")),
    );
    const result = findPaneById(tree, "p4");
    expect(result?.sessionId).toBe("deep-session");
  });

  it("returns null when given a split id (not a pane id)", () => {
    const tree = split("sp1", pane("p1"), pane("p2"));
    expect(findPaneById(tree, "sp1")).toBeNull();
  });
});
