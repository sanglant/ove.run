import type { LoopStatus, Story } from "@/types";
import classes from "./LoopPanel.module.css";

const STATUS_BADGE_CLASS: Record<LoopStatus, string> = {
  idle: classes.statusBadgeIdle,
  planning: classes.statusBadgePlanning,
  running: classes.statusBadgeRunning,
  paused: classes.statusBadgePaused,
  completed: classes.statusBadgeCompleted,
  failed: classes.statusBadgeFailed,
};

const STATUS_DOT_BG: Record<LoopStatus, string> = {
  idle: "var(--text-secondary)",
  planning: "#9ca3af",
  running: "var(--accent)",
  paused: "#f59e0b",
  completed: "#10b981",
  failed: "var(--danger)",
};

interface LoopProgressProps {
  status: LoopStatus;
  iterationCount: number;
  maxIterations: number;
  currentStoryId: string | null;
  stories: Story[];
}

export function LoopProgress({
  status,
  iterationCount,
  maxIterations,
  currentStoryId,
  stories,
}: LoopProgressProps) {
  const currentStory = currentStoryId ? stories.find((s) => s.id === currentStoryId) : null;
  const pct = maxIterations > 0 ? Math.min((iterationCount / maxIterations) * 100, 100) : 0;

  return (
    <div className={classes.progressSection}>
      <div className={classes.progressRow}>
        <span className={classes.progressLabel}>
          {currentStory ? currentStory.title : "No active story"}
        </span>
        <span className={`${classes.statusBadge} ${STATUS_BADGE_CLASS[status]}`}>
          <span
            className={classes.dot}
            style={{ background: STATUS_DOT_BG[status] }}
            aria-hidden="true"
          />
          {status}
        </span>
      </div>

      <div className={classes.progressRow}>
        <span className={classes.progressLabel}>
          Iteration {iterationCount} / {maxIterations}
        </span>
        <span className={classes.progressLabel}>
          {Math.round(pct)}%
        </span>
      </div>

      <div className={classes.progressTrack} role="progressbar" aria-valuenow={iterationCount} aria-valuemax={maxIterations}>
        <div className={classes.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
