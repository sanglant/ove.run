import { create } from "zustand";
import type { Project } from "@/types";
import {
  listProjects as apiListProjects,
  addProject as apiAddProject,
  removeProject as apiRemoveProject,
} from "@/lib/tauri";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  loadProjects: () => Promise<void>;
  addProject: (name: string, path: string) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await apiListProjects();
      set({ projects, loading: false });
      // Auto-select first project if none active
      const { activeProjectId } = get();
      if (!activeProjectId && projects.length > 0) {
        set({ activeProjectId: projects[0].id });
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      set({ loading: false });
    }
  },

  addProject: async (name: string, path: string) => {
    const project = await apiAddProject(name, path);
    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: project.id,
    }));
    return project;
  },

  removeProject: async (id: string) => {
    await apiRemoveProject(id);
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id);
      const activeProjectId =
        state.activeProjectId === id
          ? projects.length > 0
            ? projects[0].id
            : null
          : state.activeProjectId;
      return { projects, activeProjectId };
    });
  },

  setActiveProject: (id: string | null) => {
    set({ activeProjectId: id });
  },
}));
