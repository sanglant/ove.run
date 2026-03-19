import { create } from "zustand";
import type { FeedbackItem } from "@/types";

interface AgentFeedbackState {
  queue: FeedbackItem[];
  enqueue: (item: FeedbackItem) => void;
  dismissCurrent: () => void;
  dismissById: (id: string) => void;
  removeBySessionId: (sessionId: string) => void;
}

export const useAgentFeedbackStore = create<AgentFeedbackState>((set) => ({
  queue: [],

  enqueue: (item: FeedbackItem) => {
    set((state) => {
      const existingIndex = state.queue.findIndex(
        (q) => q.sessionId === item.sessionId && q.type === item.type,
      );
      // If there's an existing item with the same sessionId+type but a different id,
      // replace it with the new one so stale items don't block incoming updates.
      if (existingIndex !== -1) {
        if (state.queue[existingIndex].id === item.id) return state;
        const next = [...state.queue];
        next[existingIndex] = item;
        return { queue: next };
      }
      return { queue: [...state.queue, item] };
    });
  },

  dismissCurrent: () => {
    set((state) => ({
      queue: state.queue.slice(1),
    }));
  },

  dismissById: (id: string) => {
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
  },

  removeBySessionId: (sessionId: string) => {
    set((state) => ({
      queue: state.queue.filter((item) => item.sessionId !== sessionId),
    }));
  },
}));
