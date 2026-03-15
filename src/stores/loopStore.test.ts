import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the underlying Tauri APIs that @/lib/tauri depends on
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

import { useLoopStore } from "./loopStore";
import type { LoopEventType } from "@/types";

function initialState() {
  return {
    status: "idle" as const,
    stories: [],
    arbiterState: null,
    gateResults: {},
    reasoningLog: [],
    iterationCount: 0,
    maxIterations: 10,
    remainingStories: 0,
    qualityGates: null,
    loading: false,
    activityMessage: null,
    phase: "idle" as const,
    activeSessionId: null,
  };
}

describe("loopStore", () => {
  beforeEach(() => {
    useLoopStore.setState(initialState());
  });

  describe("handleEvent: StatusChanged", () => {
    it("updates status and phase for planning", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "planning",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("planning");
      expect(state.phase).toBe("planning");
      expect(state.activityMessage).toContain("Decomposing");
    });

    it("updates status and phase for running", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "running",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("running");
      expect(state.phase).toBe("agent");
    });

    it("updates status and phase for paused", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "paused",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("paused");
      expect(state.phase).toBe("idle");
    });

    it("updates status and phase for completed", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "completed",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("completed");
      expect(state.phase).toBe("done");
    });

    it("updates status and phase for failed", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "failed",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("failed");
      expect(state.phase).toBe("done");
    });

    it("defaults unknown status to idle phase", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "unknown_status",
      } as unknown as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("unknown_status");
      expect(state.phase).toBe("idle");
    });
  });

  describe("handleEvent: StoryStarted", () => {
    it("marks story as in_progress and sets phase to agent", () => {
      useLoopStore.setState({
        stories: [
          {
            id: "s1",
            project_id: "p1",
            title: "Fix login",
            description: "desc",
            acceptance_criteria: null,
            priority: 0,
            status: "pending",
            depends_on_json: "[]",
            iteration_attempts: 0,
            created_at: "2026-01-01",
          },
        ],
        arbiterState: { project_id: "p1", trust_level: 2, loop_status: "running", current_story_id: null, iteration_count: 0, max_iterations: 10, last_activity_at: null },
      });

      useLoopStore.getState().handleEvent({
        type: "StoryStarted",
        story_id: "s1",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.stories[0].status).toBe("in_progress");
      expect(state.phase).toBe("agent");
      expect(state.activityMessage).toContain("Fix login");
      expect(state.activeSessionId).toBe("loop-p1-s1");
    });
  });

  describe("handleEvent: StoryCompleted", () => {
    it("marks story as completed and clears activeSessionId", () => {
      useLoopStore.setState({
        stories: [
          {
            id: "s1",
            project_id: "p1",
            title: "Fix login",
            description: "desc",
            acceptance_criteria: null,
            priority: 0,
            status: "in_progress",
            depends_on_json: "[]",
            iteration_attempts: 0,
            created_at: "2026-01-01",
          },
        ],
        activeSessionId: "loop-p1-s1",
      });

      useLoopStore.getState().handleEvent({
        type: "StoryCompleted",
        story_id: "s1",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.stories[0].status).toBe("completed");
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toContain("Completed");
    });
  });

  describe("handleEvent: StoryFailed", () => {
    it("marks story as failed and shows reason", () => {
      useLoopStore.setState({
        stories: [
          {
            id: "s1",
            project_id: "p1",
            title: "Fix login",
            description: "desc",
            acceptance_criteria: null,
            priority: 0,
            status: "in_progress",
            depends_on_json: "[]",
            iteration_attempts: 0,
            created_at: "2026-01-01",
          },
        ],
        activeSessionId: "loop-p1-s1",
      });

      useLoopStore.getState().handleEvent({
        type: "StoryFailed",
        story_id: "s1",
        reason: "Quality gates failed",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.stories[0].status).toBe("failed");
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toContain("Quality gates failed");
    });
  });

  describe("handleEvent: IterationCompleted", () => {
    it("updates iteration counters", () => {
      useLoopStore.getState().handleEvent({
        type: "IterationCompleted",
        count: 3,
        max: 10,
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.iterationCount).toBe(3);
      expect(state.maxIterations).toBe(10);
      expect(state.activityMessage).toContain("3");
      expect(state.activityMessage).toContain("10");
    });
  });

  describe("handleEvent: GateResult", () => {
    it("accumulates gate results per story", () => {
      useLoopStore.getState().handleEvent({
        type: "GateResult",
        story_id: "s1",
        gate: "build",
        passed: true,
        output: "ok",
      } as LoopEventType);

      useLoopStore.getState().handleEvent({
        type: "GateResult",
        story_id: "s1",
        gate: "test",
        passed: false,
        output: "3 tests failed",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.gateResults["s1"]).toHaveLength(2);
      expect(state.gateResults["s1"][0].name).toBe("build");
      expect(state.gateResults["s1"][0].passed).toBe(true);
      expect(state.gateResults["s1"][1].name).toBe("test");
      expect(state.gateResults["s1"][1].passed).toBe(false);
      expect(state.phase).toBe("gates");
    });

    it("keeps results for different stories separate", () => {
      useLoopStore.getState().handleEvent({
        type: "GateResult",
        story_id: "s1",
        gate: "build",
        passed: true,
        output: "",
      } as LoopEventType);

      useLoopStore.getState().handleEvent({
        type: "GateResult",
        story_id: "s2",
        gate: "build",
        passed: false,
        output: "",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.gateResults["s1"]).toHaveLength(1);
      expect(state.gateResults["s2"]).toHaveLength(1);
    });
  });

  describe("handleEvent: CircuitBreakerTriggered", () => {
    it("sets status to paused with reason", () => {
      useLoopStore.getState().handleEvent({
        type: "CircuitBreakerTriggered",
        reason: "Too many retries",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("paused");
      expect(state.activityMessage).toContain("Too many retries");
    });
  });

  describe("handleEvent: LoopCompleted", () => {
    it("sets completed status and done phase", () => {
      useLoopStore.setState({ activeSessionId: "some-session" });

      useLoopStore.getState().handleEvent({
        type: "LoopCompleted",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("completed");
      expect(state.phase).toBe("done");
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toContain("completed");
    });
  });

  describe("handleEvent: LoopFailed", () => {
    it("sets failed status with reason", () => {
      useLoopStore.setState({ activeSessionId: "some-session" });

      useLoopStore.getState().handleEvent({
        type: "LoopFailed",
        reason: "Max iterations reached",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("failed");
      expect(state.phase).toBe("done");
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toContain("Max iterations reached");
    });
  });

  describe("handleEvent: LoopExhausted", () => {
    it("sets exhausted status, remainingStories count, done phase, and clears session", () => {
      useLoopStore.setState({ activeSessionId: "some-session", maxIterations: 10 });

      useLoopStore.getState().handleEvent({
        type: "LoopExhausted",
        incomplete: 3,
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("exhausted");
      expect(state.phase).toBe("done");
      expect(state.remainingStories).toBe(3);
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toContain("3");
    });

    it("uses singular 'story' when exactly one story remains", () => {
      useLoopStore.getState().handleEvent({
        type: "LoopExhausted",
        incomplete: 1,
      } as LoopEventType);

      expect(useLoopStore.getState().activityMessage).toContain("1 story remaining");
    });
  });

  describe("handleEvent: StatusChanged exhausted", () => {
    it("maps exhausted status to done phase", () => {
      useLoopStore.getState().handleEvent({
        type: "StatusChanged",
        status: "exhausted",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.status).toBe("exhausted");
      expect(state.phase).toBe("done");
      expect(state.activityMessage).toContain("exhausted");
    });
  });

  describe("handleEvent: ReasoningEntry", () => {
    it("appends to reasoning log", () => {
      useLoopStore.getState().handleEvent({
        type: "ReasoningEntry",
        action: "DecomposeRequest",
        reasoning: "Split into 3 stories",
      } as LoopEventType);

      const state = useLoopStore.getState();
      expect(state.reasoningLog).toHaveLength(1);
      expect(state.reasoningLog[0].action).toBe("DecomposeRequest");
      expect(state.reasoningLog[0].reasoning).toBe("Split into 3 stories");
      expect(state.reasoningLog[0].timestamp).toBeTruthy();
    });

    it("sets phase to judging for JudgeCompletion", () => {
      useLoopStore.getState().handleEvent({
        type: "ReasoningEntry",
        action: "JudgeCompletion",
        reasoning: "Story looks incomplete",
      } as LoopEventType);

      expect(useLoopStore.getState().phase).toBe("judging");
    });

    it("preserves phase for non-JudgeCompletion actions", () => {
      useLoopStore.setState({ phase: "agent" });

      useLoopStore.getState().handleEvent({
        type: "ReasoningEntry",
        action: "DecomposeRequest",
        reasoning: "Decomposed",
      } as LoopEventType);

      expect(useLoopStore.getState().phase).toBe("agent");
    });
  });

  describe("startLoop", () => {
    it("resets state and sets planning phase", async () => {
      useLoopStore.setState({
        stories: [{ id: "old", project_id: "p1", title: "old", description: "", acceptance_criteria: null, priority: 0, status: "completed", depends_on_json: "[]", iteration_attempts: 0, created_at: "" }],
        reasoningLog: [{ action: "x", reasoning: "y", timestamp: "" }],
        gateResults: { old: [{ name: "build", passed: true, output: "" }] },
        activeSessionId: "old-session",
      });

      await useLoopStore.getState().startLoop("p1", "/path");

      const state = useLoopStore.getState();
      expect(state.stories).toHaveLength(0);
      expect(state.reasoningLog).toHaveLength(0);
      expect(state.gateResults).toEqual({});
      expect(state.phase).toBe("planning");
      expect(state.activeSessionId).toBeNull();
    });
  });

  describe("cancelLoop", () => {
    it("resets to idle state", async () => {
      useLoopStore.setState({
        status: "running",
        phase: "agent",
        activeSessionId: "some-session",
        activityMessage: "Working...",
      });

      await useLoopStore.getState().cancelLoop();

      const state = useLoopStore.getState();
      expect(state.status).toBe("idle");
      expect(state.phase).toBe("idle");
      expect(state.activeSessionId).toBeNull();
      expect(state.activityMessage).toBeNull();
    });
  });
});
