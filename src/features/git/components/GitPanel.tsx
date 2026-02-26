import { useState, useEffect } from "react";
import { RefreshCw, GitBranch, GitMerge, FileDiff } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useGit } from "@/hooks/useGit";
import { DiffViewer } from "./DiffViewer";
import { CommitForm } from "./CommitForm";
import type { GitFileStatus } from "@/types";

const FILE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: "M", color: "text-[var(--warning)]" },
  A: { label: "A", color: "text-[var(--success)]" },
  D: { label: "D", color: "text-[var(--danger)]" },
  R: { label: "R", color: "text-[var(--accent)]" },
  "?": { label: "?", color: "text-[var(--text-secondary)]" },
  "!": { label: "!", color: "text-[var(--text-secondary)]" },
};

function getStatusMeta(statusCode: string) {
  const key = statusCode.charAt(0).toUpperCase();
  return FILE_STATUS_LABELS[key] ?? { label: key, color: "text-[var(--text-secondary)]" };
}

export function GitPanel() {
  const { activeProjectId, projects } = useProjectStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const {
    status,
    diff,
    loading,
    committing,
    refreshStatus,
    loadDiff,
    stageFiles,
    unstageFiles,
    commitChanges,
  } = useGit({ projectPath: activeProject?.path ?? null });

  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);

  useEffect(() => {
    setSelectedFile(null);
  }, [activeProjectId]);

  const handleFileClick = async (file: GitFileStatus) => {
    setSelectedFile(file);
    await loadDiff(file.path, file.staged);
  };

  const handleToggleStage = async (file: GitFileStatus) => {
    if (file.staged) {
      await unstageFiles([file.path]);
    } else {
      await stageFiles([file.path]);
    }
    // Re-load diff if this is selected file
    if (selectedFile?.path === file.path) {
      await loadDiff(file.path, !file.staged);
    }
  };

  const handleStageAll = async () => {
    const unstaged = (status?.files ?? []).filter((f) => !f.staged);
    if (unstaged.length > 0) {
      await stageFiles(unstaged.map((f) => f.path));
    }
  };

  const handleUnstageAll = async () => {
    const staged = (status?.files ?? []).filter((f) => f.staged);
    if (staged.length > 0) {
      await unstageFiles(staged.map((f) => f.path));
    }
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
        Select a project to view git status
      </div>
    );
  }

  if (!loading && status && !status.is_repo) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
        <GitMerge size={40} strokeWidth={1} />
        <div className="text-center">
          <p className="text-[var(--text-primary)] font-medium">Not a git repository</p>
          <p className="text-sm mt-1">{activeProject.path}</p>
        </div>
      </div>
    );
  }

  const stagedFiles = status?.files.filter((f) => f.staged) ?? [];
  const unstagedFiles = status?.files.filter((f) => !f.staged) ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: File list + commit */}
      <div className="flex flex-col w-64 shrink-0 border-r border-[var(--border)] overflow-hidden">
        {/* Branch header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <GitBranch size={12} />
            <span className="text-[var(--text-primary)] font-medium truncate">
              {status?.branch ?? "—"}
            </span>
            {(status?.ahead ?? 0) > 0 && (
              <span className="text-[var(--success)] text-[10px]">
                ↑{status?.ahead}
              </span>
            )}
            {(status?.behind ?? 0) > 0 && (
              <span className="text-[var(--danger)] text-[10px]">
                ↓{status?.behind}
              </span>
            )}
          </div>
          <button
            onClick={refreshStatus}
            disabled={loading}
            aria-label="Refresh git status"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:animate-spin"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {/* Staged */}
          {stagedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Staged ({stagedFiles.length})
                </span>
                <button
                  onClick={handleUnstageAll}
                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                >
                  Unstage all
                </button>
              </div>
              {stagedFiles.map((file) => {
                const meta = getStatusMeta(file.status);
                return (
                  <button
                    key={`staged-${file.path}`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleToggleStage(file)}
                    className={[
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors group",
                      selectedFile?.path === file.path && selectedFile?.staged
                        ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    <span className={`w-3 font-bold shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="truncate flex-1">{file.path}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--danger)] cursor-pointer"
                    >
                      −
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Unstaged */}
          {unstagedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 mt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Changes ({unstagedFiles.length})
                </span>
                <button
                  onClick={handleStageAll}
                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--success)] transition-colors"
                >
                  Stage all
                </button>
              </div>
              {unstagedFiles.map((file) => {
                const meta = getStatusMeta(file.status);
                return (
                  <button
                    key={`unstaged-${file.path}`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleToggleStage(file)}
                    className={[
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors group",
                      selectedFile?.path === file.path && !selectedFile?.staged
                        ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    <span className={`w-3 font-bold shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="truncate flex-1">{file.path}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--success)] cursor-pointer"
                    >
                      +
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && status?.files.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-[var(--text-secondary)]">
              <FileDiff size={24} className="mx-auto mb-2 opacity-50" />
              No changes
            </div>
          )}

          {loading && (
            <div className="px-3 py-8 text-center text-xs text-[var(--text-secondary)]">
              Loading...
            </div>
          )}
        </div>

        <CommitForm
          stagedCount={stagedFiles.length}
          onCommit={commitChanges}
        />
      </div>

      {/* Right: Diff viewer */}
      <div className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
        {committing ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
            Committing...
          </div>
        ) : (
          <DiffViewer
            diff={diff}
            filePath={selectedFile?.path}
          />
        )}
      </div>
    </div>
  );
}
