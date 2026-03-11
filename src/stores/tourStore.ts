import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TourState {
  hasSeenHomeTour: boolean;
  setHomeTourSeen: () => void;
  resetHomeTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasSeenHomeTour: false,
      setHomeTourSeen: () => set({ hasSeenHomeTour: true }),
      resetHomeTour: () => set({ hasSeenHomeTour: false }),
    }),
    { name: "agentic-tour-state" },
  ),
);
