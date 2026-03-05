import { create } from "zustand";
import type { FeedbackItem } from "@/types";

interface AgentFeedbackState {
  queue: FeedbackItem[];
  enqueue: (item: FeedbackItem) => void;
  dismissCurrent: () => void;
  removeBySessionId: (sessionId: string) => void;
}

export const useAgentFeedbackStore = create<AgentFeedbackState>((set) => ({
  queue: [],

  enqueue: (item: FeedbackItem) => {
    set((state) => {
      // Don't enqueue duplicate for same session if one already exists
      const exists = state.queue.some(
        (q) => q.sessionId === item.sessionId && q.type === item.type,
      );
      if (exists) return state;
      return { queue: [...state.queue, item] };
    });
  },

  dismissCurrent: () => {
    set((state) => ({
      queue: state.queue.slice(1),
    }));
  },

  removeBySessionId: (sessionId: string) => {
    set((state) => ({
      queue: state.queue.filter((item) => item.sessionId !== sessionId),
    }));
  },
}));
