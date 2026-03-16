import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TourState {
  hasSeenHomeTour: boolean;
  seenPanelTours: string[];
  setHomeTourSeen: () => void;
  resetHomeTour: () => void;
  markPanelTourSeen: (panel: string) => void;
  hasPanelTourBeenSeen: (panel: string) => boolean;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      hasSeenHomeTour: false,
      seenPanelTours: [],
      setHomeTourSeen: () => set({ hasSeenHomeTour: true }),
      resetHomeTour: () => set({ hasSeenHomeTour: false }),
      markPanelTourSeen: (panel: string) =>
        set((state) =>
          state.seenPanelTours.includes(panel)
            ? state
            : { seenPanelTours: [...state.seenPanelTours, panel] },
        ),
      hasPanelTourBeenSeen: (panel: string) =>
        get().seenPanelTours.includes(panel),
    }),
    { name: "ove-run-tour-state" },
  ),
);
