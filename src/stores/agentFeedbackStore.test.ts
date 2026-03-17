import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useAgentFeedbackStore } from "./agentFeedbackStore";
import type { FeedbackItem } from "@/types";

function makeFeedback(id: string, sessionId = "session-1"): FeedbackItem {
  return {
    id,
    sessionId,
    projectId: "project-1",
    type: "question",
    output: "Do you want to continue? [Y/n]",
    parsedOptions: [],
    allowFreeInput: false,
    timestamp: new Date().toISOString(),
    arbiterEnabled: false,
  };
}

describe("agentFeedbackStore", () => {
  beforeEach(() => {
    useAgentFeedbackStore.setState({ queue: [] });
  });

  describe("enqueue", () => {
    it("adds an item to the queue", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1"));
      expect(useAgentFeedbackStore.getState().queue).toHaveLength(1);
    });

    it("appends items in order", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1", "s1"));
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f2", "s2"));
      const ids = useAgentFeedbackStore.getState().queue.map((q) => q.id);
      expect(ids).toEqual(["f1", "f2"]);
    });

    it("does not add a duplicate for the same sessionId and type", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1", "s1"));
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f2", "s1")); // same sessionId, same type
      expect(useAgentFeedbackStore.getState().queue).toHaveLength(1);
    });

    it("allows items with the same sessionId but different types", () => {
      const first = makeFeedback("f1", "s1");
      const second: FeedbackItem = { ...makeFeedback("f2", "s1"), type: "response" };
      useAgentFeedbackStore.getState().enqueue(first);
      useAgentFeedbackStore.getState().enqueue(second);
      expect(useAgentFeedbackStore.getState().queue).toHaveLength(2);
    });
  });

  describe("dismissCurrent", () => {
    it("removes the first item from the queue", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1", "s1"));
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f2", "s2"));
      useAgentFeedbackStore.getState().dismissCurrent();
      const queue = useAgentFeedbackStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("f2");
    });

    it("results in empty queue when only one item present", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1"));
      useAgentFeedbackStore.getState().dismissCurrent();
      expect(useAgentFeedbackStore.getState().queue).toHaveLength(0);
    });

    it("no-ops on an already-empty queue", () => {
      expect(() => useAgentFeedbackStore.getState().dismissCurrent()).not.toThrow();
    });
  });

  describe("removeBySessionId", () => {
    it("removes all items for the given sessionId", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1", "s1"));
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f2", "s2"));
      useAgentFeedbackStore.getState().removeBySessionId("s1");
      const queue = useAgentFeedbackStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].sessionId).toBe("s2");
    });

    it("no-ops when sessionId has no items in the queue", () => {
      useAgentFeedbackStore.getState().enqueue(makeFeedback("f1", "s1"));
      useAgentFeedbackStore.getState().removeBySessionId("unknown");
      expect(useAgentFeedbackStore.getState().queue).toHaveLength(1);
    });
  });
});
