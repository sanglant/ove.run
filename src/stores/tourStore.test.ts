import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useTourStore } from "./tourStore";

describe("tourStore", () => {
  beforeEach(() => {
    useTourStore.setState({ hasSeenHomeTour: false, seenPanelTours: [] });
  });

  describe("initial state", () => {
    it("has not seen the home tour by default", () => {
      expect(useTourStore.getState().hasSeenHomeTour).toBe(false);
    });

    it("has an empty seenPanelTours list by default", () => {
      expect(useTourStore.getState().seenPanelTours).toEqual([]);
    });
  });

  describe("setHomeTourSeen", () => {
    it("marks the home tour as seen", () => {
      useTourStore.getState().setHomeTourSeen();
      expect(useTourStore.getState().hasSeenHomeTour).toBe(true);
    });
  });

  describe("resetHomeTour", () => {
    it("resets hasSeenHomeTour to false", () => {
      useTourStore.setState({ hasSeenHomeTour: true });
      useTourStore.getState().resetHomeTour();
      expect(useTourStore.getState().hasSeenHomeTour).toBe(false);
    });
  });

  describe("markPanelTourSeen", () => {
    it("adds the panel to seenPanelTours", () => {
      useTourStore.getState().markPanelTourSeen("git");
      expect(useTourStore.getState().seenPanelTours).toContain("git");
    });

    it("does not add duplicates", () => {
      useTourStore.getState().markPanelTourSeen("git");
      useTourStore.getState().markPanelTourSeen("git");
      expect(useTourStore.getState().seenPanelTours).toHaveLength(1);
    });

    it("adds multiple different panels", () => {
      useTourStore.getState().markPanelTourSeen("git");
      useTourStore.getState().markPanelTourSeen("context");
      expect(useTourStore.getState().seenPanelTours).toHaveLength(2);
    });
  });

  describe("hasPanelTourBeenSeen", () => {
    it("returns true when the panel tour has been seen", () => {
      useTourStore.getState().markPanelTourSeen("memory");
      expect(useTourStore.getState().hasPanelTourBeenSeen("memory")).toBe(true);
    });

    it("returns false when the panel tour has not been seen", () => {
      expect(useTourStore.getState().hasPanelTourBeenSeen("memory")).toBe(false);
    });
  });
});
