import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useContextStore } from "./contextStore";
import { useNotificationStore } from "./notificationStore";
import type { ContextUnit } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeUnit(id: string): ContextUnit {
  return {
    id,
    project_id: "p1",
    name: `Unit ${id}`,
    type: "knowledge",
    scope: "project",
    tags_json: "[]",
    l0_summary: null,
    l1_overview: null,
    l2_content: "Content here",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_bundled: false,
    bundled_slug: null,
  };
}

describe("contextStore", () => {
  beforeEach(() => {
    useContextStore.setState({ units: [], loading: false, filter: "all", searchQuery: "" });
    useNotificationStore.setState({ notifications: [], toasts: [] });
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("loadUnits", () => {
    it("stores units returned by invoke", async () => {
      const units = [makeUnit("u1"), makeUnit("u2")];
      mockInvoke.mockResolvedValueOnce(units);

      await useContextStore.getState().loadUnits("p1");

      expect(useContextStore.getState().units).toHaveLength(2);
      expect(useContextStore.getState().loading).toBe(false);
    });

    it("resets loading and shows toast on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("db error"));

      await useContextStore.getState().loadUnits("p1");

      expect(useContextStore.getState().loading).toBe(false);
      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });

  describe("setFilter", () => {
    it("updates the filter", () => {
      useContextStore.getState().setFilter("persona");
      expect(useContextStore.getState().filter).toBe("persona");
    });

    it("accepts all as a filter value", () => {
      useContextStore.setState({ filter: "skill" });
      useContextStore.getState().setFilter("all");
      expect(useContextStore.getState().filter).toBe("all");
    });
  });

  describe("setSearchQuery", () => {
    it("updates the search query", () => {
      useContextStore.getState().setSearchQuery("react hooks");
      expect(useContextStore.getState().searchQuery).toBe("react hooks");
    });
  });

  describe("addUnit", () => {
    it("prepends the unit to the list", async () => {
      useContextStore.setState({ units: [makeUnit("existing")] });
      const newUnit = makeUnit("u1");
      await useContextStore.getState().addUnit(newUnit);
      const units = useContextStore.getState().units;
      expect(units[0].id).toBe("u1");
      expect(units).toHaveLength(2);
    });

    it("shows toast and rethrows on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("write failed"));
      await expect(useContextStore.getState().addUnit(makeUnit("u1"))).rejects.toThrow("write failed");
      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });

  describe("editUnit", () => {
    it("replaces the matching unit in the list", async () => {
      const original = makeUnit("u1");
      useContextStore.setState({ units: [original] });
      const updated: ContextUnit = { ...original, name: "Updated Name" };
      await useContextStore.getState().editUnit(updated);
      expect(useContextStore.getState().units[0].name).toBe("Updated Name");
    });
  });

  describe("removeUnit", () => {
    it("removes the unit from the list", async () => {
      useContextStore.setState({ units: [makeUnit("u1"), makeUnit("u2")] });
      await useContextStore.getState().removeUnit("u1");
      expect(useContextStore.getState().units).toHaveLength(1);
      expect(useContextStore.getState().units[0].id).toBe("u2");
    });

    it("shows toast and rethrows on error", async () => {
      useContextStore.setState({ units: [makeUnit("u1")] });
      mockInvoke.mockRejectedValueOnce(new Error("delete failed"));
      await expect(useContextStore.getState().removeUnit("u1")).rejects.toThrow("delete failed");
      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });

  describe("duplicateUnit", () => {
    it("prepends a new unit with a different id and modified name", async () => {
      const original = makeUnit("u1");
      useContextStore.setState({ units: [original] });
      await useContextStore.getState().duplicateUnit(original);
      const units = useContextStore.getState().units;
      expect(units).toHaveLength(2);
      expect(units[0].id).not.toBe("u1");
      expect(units[0].name).toContain("Unit u1");
      expect(units[0].is_bundled).toBe(false);
    });
  });

  describe("search", () => {
    it("replaces units with search results and clears loading", async () => {
      useContextStore.setState({ units: [makeUnit("u1")] });
      const results = [makeUnit("u2"), makeUnit("u3")];
      mockInvoke.mockResolvedValueOnce(results);

      await useContextStore.getState().search("hooks");

      const state = useContextStore.getState();
      expect(state.units).toHaveLength(2);
      expect(state.units[0].id).toBe("u2");
      expect(state.loading).toBe(false);
    });

    it("accepts an optional projectId argument", async () => {
      mockInvoke.mockResolvedValueOnce([makeUnit("u1")]);

      await useContextStore.getState().search("query", "p1");

      expect(useContextStore.getState().units).toHaveLength(1);
    });

    it("resets loading and shows toast on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("fts error"));

      await useContextStore.getState().search("query");

      expect(useContextStore.getState().loading).toBe(false);
      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });
});
