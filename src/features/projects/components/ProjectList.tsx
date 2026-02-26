import { FolderGit2, Folder, GitBranch } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import type { Project } from "@/types";

interface ProjectListProps {
  onProjectClick?: (project: Project) => void;
}

export function ProjectList({ onProjectClick }: ProjectListProps) {
  const { projects, activeProjectId, setActiveProject } = useProjectStore();

  const handleClick = (project: Project) => {
    setActiveProject(project.id);
    onProjectClick?.(project);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--text-secondary)]">
        <Folder size={40} strokeWidth={1} />
        <div className="text-center">
          <p className="text-sm text-[var(--text-primary)]">No projects yet</p>
          <p className="text-xs mt-1">Add a project to get started</p>
        </div>
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-1 p-2">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        return (
          <li key={project.id}>
            <button
              onClick={() => handleClick(project)}
              aria-pressed={isActive}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-colors",
                isActive
                  ? "bg-[var(--accent)]/10 text-[var(--text-primary)] border border-[var(--accent)]/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] border border-transparent",
              ].join(" ")}
            >
              {project.git_enabled ? (
                <FolderGit2
                  size={16}
                  className={isActive ? "text-[var(--accent)]" : ""}
                />
              ) : (
                <Folder
                  size={16}
                  className={isActive ? "text-[var(--accent)]" : ""}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">
                  {project.path}
                </p>
              </div>
              {project.git_enabled && (
                <GitBranch size={11} className="text-[var(--text-secondary)] shrink-0" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
