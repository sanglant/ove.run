import type { LoopStatus, Story } from "@/types";
import type { LoopPhase } from "@/stores/loopStore";
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

const PHASE_STEPS: { key: LoopPhase; label: string }[] = [
  { key: "planning", label: "Plan" },
  { key: "agent", label: "Agent" },
  { key: "gates", label: "Gates" },
  { key: "judging", label: "Judge" },
];

interface LoopProgressProps {
  status: LoopStatus;
  iterationCount: number;
  maxIterations: number;
  currentStoryId: string | null;
  stories: Story[];
  activityMessage: string | null;
  phase: LoopPhase;
}

export function LoopProgress({
  status,
  iterationCount,
  maxIterations,
  currentStoryId,
  stories,
  activityMessage,
  phase,
}: LoopProgressProps) {
  const currentStory = currentStoryId ? stories.find((s) => s.id === currentStoryId) : null;
  const pct = maxIterations > 0 ? Math.min((iterationCount / maxIterations) * 100, 100) : 0;

  const completedCount = stories.filter((s) => s.status === "completed").length;
  const failedCount = stories.filter((s) => s.status === "failed").length;
  const inProgressCount = stories.filter((s) => s.status === "in_progress").length;
  const totalStories = stories.length;
  const storyPct = totalStories > 0 ? Math.round((completedCount / totalStories) * 100) : 0;

  const isActive = status === "running" || status === "planning";

  return (
    <div className={classes.progressSection}>
      {/* Status row */}
      <div className={classes.progressRow}>
        <span className={`${classes.statusBadge} ${STATUS_BADGE_CLASS[status]}`}>
          <span
            className={classes.dot}
            style={{ background: STATUS_DOT_BG[status] }}
            aria-hidden="true"
          />
          {status}
        </span>
        {totalStories > 0 && (
          <span className={classes.progressLabel}>
            {completedCount}/{totalStories} stories
            {inProgressCount > 0 && <span style={{ color: "var(--accent)" }}> ({inProgressCount} active)</span>}
            {failedCount > 0 && <span style={{ color: "var(--danger)" }}> ({failedCount} failed)</span>}
          </span>
        )}
      </div>

      {/* Phase steps — show when loop is active */}
      {(isActive || status === "paused") && (
        <div className={classes.phaseSteps}>
          {PHASE_STEPS.map((step) => {
            const phaseIdx = PHASE_STEPS.findIndex((s) => s.key === phase);
            const stepIdx = PHASE_STEPS.findIndex((s) => s.key === step.key);
            const isCurrent = step.key === phase;
            const isPast = stepIdx < phaseIdx;
            return (
              <div
                key={step.key}
                className={`${classes.phaseStep} ${isCurrent ? classes.phaseStepActive : ""} ${isPast ? classes.phaseStepDone : ""}`}
              >
                <span className={classes.phaseStepDot} />
                <span className={classes.phaseStepLabel}>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity message */}
      {activityMessage && (
        <div className={classes.activityRow}>
          {isActive && (
            <span className={classes.activitySpinner} aria-hidden="true" />
          )}
          <span className={classes.activityText}>{activityMessage}</span>
        </div>
      )}

      {/* Current story */}
      {currentStory && (
        <div className={classes.progressRow}>
          <span className={classes.progressLabel}>
            {currentStory.title}
          </span>
        </div>
      )}

      {/* Story progress bar */}
      {totalStories > 0 && (
        <div className={classes.progressRow}>
          <span className={classes.progressLabel}>
            Stories {storyPct}%
          </span>
          <span className={classes.progressLabel}>
            Iteration {iterationCount} / {maxIterations}
          </span>
        </div>
      )}

      {totalStories > 0 ? (
        <div className={classes.progressTrack} role="progressbar" aria-valuenow={completedCount} aria-valuemax={totalStories}>
          <div className={classes.progressFill} style={{ width: `${storyPct}%` }} />
        </div>
      ) : (
        <div className={classes.progressRow}>
          <span className={classes.progressLabel}>
            Iteration {iterationCount} / {maxIterations} ({Math.round(pct)}%)
          </span>
        </div>
      )}
    </div>
  );
}
