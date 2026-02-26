import { useState, useEffect } from "react";
import { RefreshCw, GitBranch, GitMerge, FileDiff } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useGit } from "@/hooks/useGit";
import { DiffViewer } from "./DiffViewer";
import { CommitForm } from "./CommitForm";
import type { GitFileStatus } from "@/types";
import { Group, Text, ActionIcon } from "@mantine/core";
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Select a project to view git status
      </div>
    );
  }

  if (!loading && status && !status.is_repo) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <GitMerge size={40} strokeWidth={1} />
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-primary)", fontWeight: 500, margin: 0 }}>
            Not a git repository
          </p>
          <p style={{ fontSize: "14px", marginTop: "4px", marginBottom: 0 }}>
            {activeProject.path}
          </p>
        </div>
      </div>
    );
  }

  const stagedFiles = status?.files.filter((f) => f.staged) ?? [];
  const unstagedFiles = status?.files.filter((f) => !f.staged) ?? [];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: File list + commit */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "256px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        {/* Branch header */}
        <div
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "8px 12px",
          }}
        >
          <Group justify="space-between" wrap="nowrap" gap={0}>
            <Group gap={6} wrap="nowrap">
              <GitBranch size={12} color="var(--text-secondary)" />
              <Text
                size="xs"
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {status?.branch ?? "—"}
              </Text>
              {(status?.ahead ?? 0) > 0 && (
                <Text style={{ color: "var(--success)", fontSize: "10px" }}>
                  ↑{status?.ahead}
                </Text>
              )}
              {(status?.behind ?? 0) > 0 && (
                <Text style={{ color: "var(--danger)", fontSize: "10px" }}>
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
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Staged */}
          {stagedFiles.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                }}
              >
                <Text
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-secondary)",
                  }}
                >
                  Staged ({stagedFiles.length})
                </Text>
                <button
                  onClick={handleUnstageAll}
                  style={{
                    fontSize: "10px",
                    color: "var(--text-secondary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 150ms",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--danger)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-secondary)")
                  }
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
                    className={classes.row}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      textAlign: "left",
                      background: isSelected ? "var(--bg-tertiary)" : "none",
                      border: "none",
                      cursor: "pointer",
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      transition: "background 150ms, color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--bg-tertiary)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "none";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        fontWeight: 700,
                        flexShrink: 0,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {file.path}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className={classes.revealOnHover}
                      style={{
                        fontSize: "10px",
                        color: "var(--danger)",
                        cursor: "pointer",
                      }}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  marginTop: "4px",
                }}
              >
                <Text
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-secondary)",
                  }}
                >
                  Changes ({unstagedFiles.length})
                </Text>
                <button
                  onClick={handleStageAll}
                  style={{
                    fontSize: "10px",
                    color: "var(--text-secondary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 150ms",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--success)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-secondary)")
                  }
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
                    className={classes.row}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      textAlign: "left",
                      background: isSelected ? "var(--bg-tertiary)" : "none",
                      border: "none",
                      cursor: "pointer",
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      transition: "background 150ms, color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--bg-tertiary)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "none";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        fontWeight: 700,
                        flexShrink: 0,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {file.path}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStage(file);
                      }}
                      className={classes.revealOnHover}
                      style={{
                        fontSize: "10px",
                        color: "var(--success)",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && status?.files.length === 0 && (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              <FileDiff
                size={24}
                style={{ margin: "0 auto 8px", display: "block", opacity: 0.5 }}
              />
              No changes
            </div>
          )}

          {loading && (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              Loading...
            </div>
          )}
        </div>

        <CommitForm stagedCount={stagedFiles.length} onCommit={commitChanges} />
      </div>

      {/* Right: Diff viewer */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {committing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-secondary)",
              fontSize: "14px",
            }}
          >
            Committing...
          </div>
        ) : (
          <DiffViewer diff={diff} filePath={selectedFile?.path} />
        )}
      </div>
    </div>
  );
}
