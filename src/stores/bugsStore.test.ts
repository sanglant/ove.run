import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useBugsStore } from "./bugsStore";
import type { BugItem, ProviderConfig } from "../features/bugs/types";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeBug(id: string): BugItem {
  return {
    id,
    key: `BUG-${id}`,
    title: `Bug ${id}`,
    description: "A bug",
    status: "open",
    priority: "high",
    assignee: null,
    labels: [],
    url: `https://example.com/bug/${id}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const makeConfig = (): ProviderConfig => ({
  provider: "github_projects",
  project_key: "my-project",
  base_url: null,
  board_id: null,
  client_id: null,
  client_secret: null,
});

describe("bugsStore", () => {
  beforeEach(() => {
    useBugsStore.getState().reset();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("initial state", () => {
    it("starts with empty bugs and no selection", () => {
      const state = useBugsStore.getState();
      expect(state.bugs).toEqual([]);
      expect(state.selectedBug).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.providerConfig).toBeNull();
      expect(state.authenticated).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears all state fields", () => {
      useBugsStore.setState({
        bugs: [makeBug("b1")],
        selectedBug: makeBug("b1"),
        loading: true,
        providerConfig: makeConfig(),
        authenticated: true,
      });

      useBugsStore.getState().reset();

      const state = useBugsStore.getState();
      expect(state.bugs).toEqual([]);
      expect(state.selectedBug).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.providerConfig).toBeNull();
      expect(state.authenticated).toBe(false);
    });
  });

  describe("loadBugs", () => {
    it("stores bugs returned by invoke", async () => {
      const bugs = [makeBug("b1"), makeBug("b2")];
      mockInvoke.mockResolvedValueOnce(bugs);

      await useBugsStore.getState().loadBugs("p1");

      expect(useBugsStore.getState().bugs).toHaveLength(2);
      expect(useBugsStore.getState().loading).toBe(false);
    });

    it("resets loading on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("network error"));

      await useBugsStore.getState().loadBugs("p1");

      expect(useBugsStore.getState().loading).toBe(false);
    });
  });

  describe("clearSelection", () => {
    it("sets selectedBug to null", () => {
      useBugsStore.setState({ selectedBug: makeBug("b1") });
      useBugsStore.getState().clearSelection();
      expect(useBugsStore.getState().selectedBug).toBeNull();
    });
  });

  describe("selectBug", () => {
    it("sets the selected bug to the detail returned by invoke", async () => {
      const detail = makeBug("b1");
      mockInvoke.mockResolvedValueOnce(detail);

      await useBugsStore.getState().selectBug("p1", makeBug("b1"));

      expect(useBugsStore.getState().selectedBug?.id).toBe("b1");
    });

    it("falls back to the passed bug when invoke fails", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("not found"));
      const bug = makeBug("b1");

      await useBugsStore.getState().selectBug("p1", bug);

      expect(useBugsStore.getState().selectedBug?.id).toBe("b1");
    });
  });

  describe("loadConfig", () => {
    it("stores provider config and authenticated flag", async () => {
      const config = makeConfig();
      // First call returns config, second returns true (checkBugAuth)
      mockInvoke.mockResolvedValueOnce(config).mockResolvedValueOnce(true);

      await useBugsStore.getState().loadConfig("p1");

      expect(useBugsStore.getState().providerConfig).toEqual(config);
      expect(useBugsStore.getState().authenticated).toBe(true);
    });

    it("sets authenticated to false when config is null", async () => {
      mockInvoke.mockResolvedValueOnce(null);

      await useBugsStore.getState().loadConfig("p1");

      expect(useBugsStore.getState().providerConfig).toBeNull();
      expect(useBugsStore.getState().authenticated).toBe(false);
    });
  });
});
