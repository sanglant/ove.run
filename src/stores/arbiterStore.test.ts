import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useArbiterStore } from "./arbiterStore";
import type { ArbiterState, Story } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeArbiterState(projectId: string): ArbiterState {
  return {
    project_id: projectId,
    trust_level: 2,
    loop_status: "idle",
    current_story_id: null,
    iteration_count: 0,
    max_iterations: 10,
    last_activity_at: null,
  };
}

function makeStory(id: string, projectId: string): Story {
  return {
    id,
    project_id: projectId,
    title: `Story ${id}`,
    description: "desc",
    acceptance_criteria: null,
    priority: 0,
    status: "pending",
    depends_on_json: "[]",
    iteration_attempts: 0,
    created_at: new Date().toISOString(),
  };
}

describe("arbiterStore", () => {
  beforeEach(() => {
    useArbiterStore.setState({ arbiterState: {}, stories: {}, loading: false });
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("loadArbiterState", () => {
    it("stores the returned state keyed by projectId", async () => {
      const state = makeArbiterState("p1");
      mockInvoke.mockResolvedValueOnce(state);

      await useArbiterStore.getState().loadArbiterState("p1");

      expect(useArbiterStore.getState().arbiterState["p1"]).toEqual(state);
      expect(useArbiterStore.getState().loading).toBe(false);
    });

    it("does not set state when invoke returns null", async () => {
      mockInvoke.mockResolvedValueOnce(null);

      await useArbiterStore.getState().loadArbiterState("p1");

      expect(useArbiterStore.getState().arbiterState["p1"]).toBeUndefined();
      expect(useArbiterStore.getState().loading).toBe(false);
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("backend error"));

      await useArbiterStore.getState().loadArbiterState("p1");

      expect(useArbiterStore.getState().loading).toBe(false);
    });

    it("keeps states for other projects when adding a new one", async () => {
      useArbiterStore.setState({
        arbiterState: { existing: makeArbiterState("existing") },
      });
      mockInvoke.mockResolvedValueOnce(makeArbiterState("p1"));

      await useArbiterStore.getState().loadArbiterState("p1");

      expect(useArbiterStore.getState().arbiterState["existing"]).toBeDefined();
      expect(useArbiterStore.getState().arbiterState["p1"]).toBeDefined();
    });
  });

  describe("loadStories", () => {
    it("stores stories keyed by projectId", async () => {
      const stories = [makeStory("s1", "p1"), makeStory("s2", "p1")];
      mockInvoke.mockResolvedValueOnce(stories);

      await useArbiterStore.getState().loadStories("p1");

      expect(useArbiterStore.getState().stories["p1"]).toHaveLength(2);
      expect(useArbiterStore.getState().loading).toBe(false);
    });

    it("stores an empty array when invoke returns []", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await useArbiterStore.getState().loadStories("p1");

      expect(useArbiterStore.getState().stories["p1"]).toEqual([]);
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("db error"));

      await useArbiterStore.getState().loadStories("p1");

      expect(useArbiterStore.getState().loading).toBe(false);
    });

    it("keeps stories for other projects", async () => {
      useArbiterStore.setState({
        stories: { other: [makeStory("s0", "other")] },
      });
      mockInvoke.mockResolvedValueOnce([makeStory("s1", "p1")]);

      await useArbiterStore.getState().loadStories("p1");

      expect(useArbiterStore.getState().stories["other"]).toHaveLength(1);
      expect(useArbiterStore.getState().stories["p1"]).toHaveLength(1);
    });
  });

  describe("setTrustLevel", () => {
    it("updates the trust level for the project in-memory", async () => {
      useArbiterStore.setState({ arbiterState: { p1: makeArbiterState("p1") } });

      await useArbiterStore.getState().setTrustLevel("p1", 3);

      expect(useArbiterStore.getState().arbiterState["p1"].trust_level).toBe(3);
    });

    it("no-ops when no arbiterState exists for the project", async () => {
      await expect(useArbiterStore.getState().setTrustLevel("unknown", 1)).resolves.not.toThrow();
    });
  });
});
