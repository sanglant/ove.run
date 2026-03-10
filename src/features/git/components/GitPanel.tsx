import { useState, useEffect } from "react";
import { RefreshCw, GitBranch, GitMerge, FileDiff } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useGit } from "@/hooks/useGit";
import { DiffViewer } from "./DiffViewer";
import { CommitForm } from "./CommitForm";
import type { GitFileStatus } from "@/types";
import { Group, Text, ActionIcon } from "@mantine/core";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import cn from "clsx";
import classes from "./GitPanel.module.css";

const FILE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: "M", color: "var(--warning)" },
  A: { label: "A", color: "var(--success)" },
  D: { label: "D", color: "var(--danger)" },
  R: { label: "R", color: "var(--accent)" },
  "?": { label: "?", color: "var(--text-secondary)" },
  "!": { label: "!", color: "var(--text-secondary)" },
};

function getStatusMeta(statusCode: string) {
  const key = statusCode.charAt(0).toUpperCase();
  return FILE_STATUS_LABELS[key] ?? { label: key, color: "var(--text-secondary)" };
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
      <EmptyState
        icon={<GitBranch size={40} strokeWidth={1} />}
        title="Select a project to view git status"
      />
    );
  }

  if (!loading && status && !status.is_repo) {
    return (
      <EmptyState
        icon={<GitMerge size={40} strokeWidth={1} />}
        title="Not a git repository"
        description={activeProject.path}
      />
    );
  }

  const stagedFiles = status?.files.filter((f) => f.staged) ?? [];
  const unstagedFiles = status?.files.filter((f) => !f.staged) ?? [];

  return (
    <div className={classes.container}>
      {/* Left: File list + commit */}
      <div className={classes.fileListPanel}>
        {/* Branch header */}
        <div className={classes.branchHeader}>
          <Group justify="space-between" wrap="nowrap" gap={0}>
            <Group gap={6} wrap="nowrap">
              <GitBranch size={12} color="var(--text-secondary)" />
              <Text size="xs" className={classes.branchName}>
                {status?.branch ?? "—"}
              </Text>
              {(status?.ahead ?? 0) > 0 && (
                <Text c="var(--success)" fz={10}>
                  ↑{status?.ahead}
                </Text>
              )}
              {(status?.behind ?? 0) > 0 && (
                <Text c="var(--danger)" fz={10}>
                  ↓{status?.behind}
                </Text>
              )}
            </Group>
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={refreshStatus}
              disabled={loading}
              loading={loading}
              aria-label="Refresh git status"
              styles={{
                root: {
                  color: "var(--text-secondary)",
                  "&:hover": { color: "var(--text-primary)", backgroundColor: "transparent" },
                  "&[data-disabled]": { opacity: 0.4 },
                },
              }}
            >
              <RefreshCw size={12} />
            </ActionIcon>
          </Group>
        </div>

        {/* File list */}
        <div className={classes.fileListScroll}>
          {/* Staged */}
          {stagedFiles.length > 0 && (
            <div>
              <div className={classes.sectionHeader}>
                <SectionTitle mb={0}>
                  Staged ({stagedFiles.length})
                </SectionTitle>
                <button
                  onClick={handleUnstageAll}
                  className={cn(classes.sectionAction, classes.sectionActionUnstage)}
                >
                  Unstage all
                </button>
              </div>
              {stagedFiles.map((file) => {
                const meta = getStatusMeta(file.status);
                const isSelected =
                  selectedFile?.path === file.path && selectedFile?.staged;
                return (
                  <button
                    key={`staged-${file.path}`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleToggleStage(file)}
                    className={cn(classes.row, classes.fileButton, isSelected && classes.fileButtonSelected)}
                  >
                    <span className={classes.statusLabel} style={{ '--status-color': meta.color } as React.CSSProperties}>
                      {meta.label}
                    </span>
                    <span className={classes.filePath}>
                      {file.path}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className={cn(classes.revealOnHover, classes.toggleUnstage)}
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
              <div className={classes.sectionHeaderSpaced}>
                <SectionTitle mb={0}>
                  Changes ({unstagedFiles.length})
                </SectionTitle>
                <button
                  onClick={handleStageAll}
                  className={cn(classes.sectionAction, classes.sectionActionStage)}
                >
                  Stage all
                </button>
              </div>
              {unstagedFiles.map((file) => {
                const meta = getStatusMeta(file.status);
                const isSelected =
                  selectedFile?.path === file.path && !selectedFile?.staged;
                return (
                  <button
                    key={`unstaged-${file.path}`}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleToggleStage(file)}
                    className={cn(classes.row, classes.fileButton, isSelected && classes.fileButtonSelected)}
                  >
                    <span className={classes.statusLabel} style={{ '--status-color': meta.color } as React.CSSProperties}>
                      {meta.label}
                    </span>
                    <span className={classes.filePath}>
                      {file.path}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className={cn(classes.revealOnHover, classes.toggleStage)}
                    >
                      +
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && status?.files.length === 0 && (
            <div className={classes.emptyFiles}>
              <FileDiff size={24} className={classes.emptyFilesIcon} />
              No changes
            </div>
          )}

          {loading && (
            <div className={classes.emptyFiles}>
              Loading...
            </div>
          )}
        </div>

        <CommitForm stagedCount={stagedFiles.length} onCommit={commitChanges} />
      </div>

      {/* Right: Diff viewer */}
      <div className={classes.diffPanel}>
        {committing ? (
          <div className={classes.centeredText}>
            Committing...
          </div>
        ) : (
          <DiffViewer diff={diff} filePath={selectedFile?.path} />
        )}
      </div>
    </div>
  );
}
