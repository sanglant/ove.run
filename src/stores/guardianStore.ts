import { create } from "zustand";
import type { ReviewRequest } from "@/types";

interface GuardianState {
  guardianSessionIds: Record<string, string>;
  reviewQueue: ReviewRequest[];
  activeReview: ReviewRequest | null;
  outputBuffers: Record<string, string>;
  guardianInitialized: Record<string, boolean>;

  setGuardianSession: (projectId: string, sessionId: string) => void;
  removeGuardianSession: (projectId: string) => void;
  updateOutputBuffer: (sessionId: string, buffer: string) => void;
  removeOutputBuffer: (sessionId: string) => void;
  enqueueReview: (review: ReviewRequest) => void;
  setActiveReview: (review: ReviewRequest | null) => void;
  updateReviewStatus: (
    reviewId: string,
    status: ReviewRequest["status"],
    output?: string,
    reasoning?: string,
  ) => void;
  dequeueNextReview: (projectId: string) => ReviewRequest | null;
  setGuardianInitialized: (projectId: string, initialized: boolean) => void;
  clearProjectGuardianState: (projectId: string) => void;
}

export const useGuardianStore = create<GuardianState>((set, get) => ({
  guardianSessionIds: {},
  reviewQueue: [],
  activeReview: null,
  outputBuffers: {},
  guardianInitialized: {},

  setGuardianSession: (projectId: string, sessionId: string) => {
    set((state) => ({
      guardianSessionIds: { ...state.guardianSessionIds, [projectId]: sessionId },
    }));
  },

  removeGuardianSession: (projectId: string) => {
    set((state) => {
      const guardianSessionIds = { ...state.guardianSessionIds };
      delete guardianSessionIds[projectId];
      return { guardianSessionIds };
    });
  },

  updateOutputBuffer: (sessionId: string, buffer: string) => {
    set((state) => ({
      outputBuffers: { ...state.outputBuffers, [sessionId]: buffer },
    }));
  },

  removeOutputBuffer: (sessionId: string) => {
    set((state) => {
      const outputBuffers = { ...state.outputBuffers };
      delete outputBuffers[sessionId];
      return { outputBuffers };
    });
  },

  enqueueReview: (review: ReviewRequest) => {
    set((state) => ({
      reviewQueue: [...state.reviewQueue, review],
    }));
  },

  setActiveReview: (review: ReviewRequest | null) => {
    set({ activeReview: review });
  },

  updateReviewStatus: (
    reviewId: string,
    status: ReviewRequest["status"],
    output?: string,
    reasoning?: string,
  ) => {
    set((state) => ({
      reviewQueue: state.reviewQueue.map((r) =>
        r.id === reviewId
          ? { ...r, status, guardianOutput: output ?? r.guardianOutput, guardianReasoning: reasoning ?? r.guardianReasoning }
          : r,
      ),
      activeReview:
        state.activeReview?.id === reviewId
          ? { ...state.activeReview, status, guardianOutput: output ?? state.activeReview.guardianOutput, guardianReasoning: reasoning ?? state.activeReview.guardianReasoning }
          : state.activeReview,
    }));
  },

  dequeueNextReview: (projectId: string) => {
    const state = get();
    const index = state.reviewQueue.findIndex((r) => r.projectId === projectId);
    if (index === -1) return null;
    const review = state.reviewQueue[index];
    set((s) => ({
      reviewQueue: s.reviewQueue.filter((_, i) => i !== index),
    }));
    return review;
  },

  setGuardianInitialized: (projectId: string, initialized: boolean) => {
    set((state) => ({
      guardianInitialized: { ...state.guardianInitialized, [projectId]: initialized },
    }));
  },

  clearProjectGuardianState: (projectId: string) => {
    set((state) => {
      const guardianSessionIds = { ...state.guardianSessionIds };
      delete guardianSessionIds[projectId];

      const guardianInitialized = { ...state.guardianInitialized };
      delete guardianInitialized[projectId];

      const reviewQueue = state.reviewQueue.filter((r) => r.projectId !== projectId);

      const activeReview =
        state.activeReview?.projectId === projectId ? null : state.activeReview;

      return { guardianSessionIds, guardianInitialized, reviewQueue, activeReview };
    });
  },
}));
