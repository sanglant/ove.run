import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn().mockResolvedValue(undefined) }));

import { useProjectStore } from "./projectStore";
import { useNotificationStore } from "./notificationStore";
import type { Project } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    path: `/projects/${id}`,
    created_at: new Date().toISOString(),
    git_enabled: false,
    arbiter_enabled: false,
  };
}

describe("projectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], activeProjectId: null, loading: false });
    useNotificationStore.setState({ notifications: [], toasts: [] });
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("setActiveProject", () => {
    it("sets the active project id", () => {
      useProjectStore.setState({ projects: [makeProject("p1")] });
      useProjectStore.getState().setActiveProject("p1");
      expect(useProjectStore.getState().activeProjectId).toBe("p1");
    });

    it("accepts null to clear the active project", () => {
      useProjectStore.setState({ activeProjectId: "p1" });
      useProjectStore.getState().setActiveProject(null);
      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });
  });

  describe("addProject", () => {
    it("adds the project returned by invoke and sets it active", async () => {
      const project = makeProject("p1");
      mockInvoke.mockResolvedValueOnce(project);

      await useProjectStore.getState().addProject("Project p1", "/projects/p1");

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe("p1");
      expect(state.activeProjectId).toBe("p1");
    });

    it("shows an error toast and rethrows when invoke fails", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("disk full"));

      await expect(
        useProjectStore.getState().addProject("Bad", "/bad"),
      ).rejects.toThrow("disk full");

      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });

  describe("removeProject", () => {
    it("removes the project from the list", async () => {
      useProjectStore.setState({ projects: [makeProject("p1"), makeProject("p2")] });
      await useProjectStore.getState().removeProject("p1");

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe("p2");
    });

    it("switches activeProjectId to first remaining project when active one is removed", async () => {
      useProjectStore.setState({
        projects: [makeProject("p1"), makeProject("p2")],
        activeProjectId: "p1",
      });

      await useProjectStore.getState().removeProject("p1");

      expect(useProjectStore.getState().activeProjectId).toBe("p2");
    });

    it("sets activeProjectId to null when removing the only project", async () => {
      useProjectStore.setState({
        projects: [makeProject("p1")],
        activeProjectId: "p1",
      });

      await useProjectStore.getState().removeProject("p1");

      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });

    it("preserves activeProjectId when a non-active project is removed", async () => {
      useProjectStore.setState({
        projects: [makeProject("p1"), makeProject("p2")],
        activeProjectId: "p2",
      });

      await useProjectStore.getState().removeProject("p1");

      expect(useProjectStore.getState().activeProjectId).toBe("p2");
    });

    it("shows an error toast and rethrows when invoke fails", async () => {
      useProjectStore.setState({ projects: [makeProject("p1")] });
      mockInvoke.mockRejectedValueOnce(new Error("not found"));

      await expect(useProjectStore.getState().removeProject("p1")).rejects.toThrow("not found");
      expect(useNotificationStore.getState().toasts[0]?.level).toBe("error");
    });
  });

  describe("updateProject", () => {
    it("updates the matching project in the list", async () => {
      const original = makeProject("p1");
      useProjectStore.setState({ projects: [original] });

      const updated: Project = { ...original, name: "Renamed" };
      await useProjectStore.getState().updateProject(updated);

      expect(useProjectStore.getState().projects[0].name).toBe("Renamed");
    });

    it("does not affect other projects", async () => {
      const p1 = makeProject("p1");
      const p2 = makeProject("p2");
      useProjectStore.setState({ projects: [p1, p2] });

      await useProjectStore.getState().updateProject({ ...p1, name: "Changed" });

      expect(useProjectStore.getState().projects[1].name).toBe("Project p2");
    });
  });

  describe("loadProjects", () => {
    it("populates projects from invoke and auto-selects the first one", async () => {
      const projects = [makeProject("p1"), makeProject("p2")];
      mockInvoke.mockResolvedValueOnce(projects);

      await useProjectStore.getState().loadProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.activeProjectId).toBe("p1");
      expect(state.loading).toBe(false);
    });

    it("does not override an already-active project on reload", async () => {
      useProjectStore.setState({ activeProjectId: "p2" });
      const projects = [makeProject("p1"), makeProject("p2")];
      mockInvoke.mockResolvedValueOnce(projects);

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().activeProjectId).toBe("p2");
    });
  });
});
