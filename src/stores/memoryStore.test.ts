import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useMemoryStore } from "./memoryStore";
import type { Memory, Consolidation } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeMemory(id: string): Memory {
  return {
    id,
    project_id: "p1",
    session_id: null,
    visibility: "private",
    content: `Memory content ${id}`,
    summary: null,
    entities_json: "[]",
    topics_json: "[]",
    importance: 1,
    consolidated: false,
    created_at: new Date().toISOString(),
  };
}

function makeConsolidation(id: string): Consolidation {
  return {
    id,
    project_id: "p1",
    source_ids_json: "[]",
    summary: `Summary ${id}`,
    insight: `Insight ${id}`,
    created_at: new Date().toISOString(),
  };
}

describe("memoryStore", () => {
  beforeEach(() => {
    useMemoryStore.setState({ memories: [], consolidations: [], loading: false });
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("loadMemories", () => {
    it("stores memories returned by invoke", async () => {
      const memories = [makeMemory("m1"), makeMemory("m2")];
      mockInvoke.mockResolvedValueOnce(memories);

      await useMemoryStore.getState().loadMemories("p1");

      expect(useMemoryStore.getState().memories).toHaveLength(2);
      expect(useMemoryStore.getState().loading).toBe(false);
    });

    it("accepts an optional sessionId argument", async () => {
      mockInvoke.mockResolvedValueOnce([makeMemory("m1")]);

      await useMemoryStore.getState().loadMemories("p1", "session-1");

      expect(useMemoryStore.getState().memories).toHaveLength(1);
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("db error"));

      await useMemoryStore.getState().loadMemories("p1");

      expect(useMemoryStore.getState().loading).toBe(false);
    });
  });

  describe("loadConsolidations", () => {
    it("stores consolidations returned by invoke", async () => {
      const consolidations = [makeConsolidation("c1")];
      mockInvoke.mockResolvedValueOnce(consolidations);

      await useMemoryStore.getState().loadConsolidations("p1");

      expect(useMemoryStore.getState().consolidations).toHaveLength(1);
      expect(useMemoryStore.getState().loading).toBe(false);
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("fetch error"));

      await useMemoryStore.getState().loadConsolidations("p1");

      expect(useMemoryStore.getState().loading).toBe(false);
    });
  });

  describe("toggleVisibility", () => {
    it("updates visibility for the matching memory", async () => {
      useMemoryStore.setState({ memories: [makeMemory("m1")] });
      await useMemoryStore.getState().toggleVisibility("m1", "public");
      expect(useMemoryStore.getState().memories[0].visibility).toBe("public");
    });

    it("does not affect other memories", async () => {
      useMemoryStore.setState({ memories: [makeMemory("m1"), makeMemory("m2")] });
      await useMemoryStore.getState().toggleVisibility("m1", "public");
      expect(useMemoryStore.getState().memories[1].visibility).toBe("private");
    });
  });

  describe("removeMemory", () => {
    it("removes the matching memory", async () => {
      useMemoryStore.setState({ memories: [makeMemory("m1"), makeMemory("m2")] });
      await useMemoryStore.getState().removeMemory("m1");
      expect(useMemoryStore.getState().memories).toHaveLength(1);
      expect(useMemoryStore.getState().memories[0].id).toBe("m2");
    });
  });

  describe("search", () => {
    it("replaces memories with search results", async () => {
      useMemoryStore.setState({ memories: [makeMemory("m1")] });
      const results = [makeMemory("m3"), makeMemory("m4")];
      mockInvoke.mockResolvedValueOnce(results);

      await useMemoryStore.getState().search("query", "p1");

      expect(useMemoryStore.getState().memories).toHaveLength(2);
      expect(useMemoryStore.getState().memories[0].id).toBe("m3");
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("search error"));
      await useMemoryStore.getState().search("query", "p1");
      expect(useMemoryStore.getState().loading).toBe(false);
    });
  });
});
