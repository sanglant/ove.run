import { useState, useEffect, useCallback } from "react";
import {
  gitStatus,
  gitDiff,
  gitDiffFile,
  gitStage,
  gitUnstage,
  gitCommit,
} from "@/lib/tauri";
import type { GitStatus } from "@/types";

interface UseGitOptions {
  projectPath: string | null;
}

export function useGit({ projectPath }: UseGitOptions) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const s = await gitStatus(projectPath);
      setStatus(s);
    } catch (err) {
      console.error("Failed to get git status:", err);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const loadDiff = useCallback(
    async (filePath?: string, staged?: boolean) => {
      if (!projectPath) return;
      try {
        let d: string;
        if (filePath !== undefined) {
          d = await gitDiffFile(projectPath, filePath, staged ?? false);
        } else {
          d = await gitDiff(projectPath, staged ?? false);
        }
        setDiff(d);
      } catch (err) {
        console.error("Failed to get git diff:", err);
        setDiff("");
      }
    },
    [projectPath],
  );

  const stageFiles = useCallback(
    async (files: string[]) => {
      if (!projectPath) return;
      try {
        await gitStage(projectPath, files);
        await refreshStatus();
      } catch (err) {
        console.error("Failed to stage files:", err);
      }
    },
    [projectPath, refreshStatus],
  );

  const unstageFiles = useCallback(
    async (files: string[]) => {
      if (!projectPath) return;
      try {
        await gitUnstage(projectPath, files);
        await refreshStatus();
      } catch (err) {
        console.error("Failed to unstage files:", err);
      }
    },
    [projectPath, refreshStatus],
  );

  const commitChanges = useCallback(
    async (message: string) => {
      if (!projectPath) return false;
      setCommitting(true);
      try {
        await gitCommit(projectPath, message);
        await refreshStatus();
        setDiff("");
        return true;
      } catch (err) {
        console.error("Failed to commit:", err);
        return false;
      } finally {
        setCommitting(false);
      }
    },
    [projectPath, refreshStatus],
  );

  useEffect(() => {
    if (projectPath) {
      refreshStatus();
    } else {
      setStatus(null);
      setDiff("");
    }
  }, [projectPath, refreshStatus]);

  return {
    status,
    diff,
    loading,
    committing,
    refreshStatus,
    loadDiff,
    stageFiles,
    unstageFiles,
    commitChanges,
  };
}
