import { useEffect, useState } from "react";
import { useArbiterStore } from "@/stores/arbiterStore";
import { TRUST_LEVEL_LABELS } from "@/types";
import type { TrustLevel, LoopStatus } from "@/types";
import { formatRelativeTime } from "@/lib/formatTime";
import { TrustLevelSelector } from "./TrustLevelSelector";
import classes from "./ArbiterStatusPanel.module.css";

interface ArbiterStatusPanelProps {
  projectId: string;
}

const STATUS_DOT_CLASS: Record<LoopStatus, string> = {
  idle: classes.dotGray,
  planning: classes.dotBlue,
  running: classes.dotGreen,
  paused: classes.dotYellow,
  completed: classes.dotGreen,
  failed: classes.dotRed,
  exhausted: classes.dotYellow,
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return formatRelativeTime(iso);
}

export function ArbiterStatusPanel({ projectId }: ArbiterStatusPanelProps) {
  const loadArbiterState = useArbiterStore((s) => s.loadArbiterState);
  const setTrustLevel = useArbiterStore((s) => s.setTrustLevel);
  const arbiterStateMap = useArbiterStore((s) => s.arbiterState);
  const state = arbiterStateMap[projectId] ?? null;

  const [trustPopoverOpen, setTrustPopoverOpen] = useState(false);

  useEffect(() => {
    loadArbiterState(projectId);
  }, [projectId, loadArbiterState]);

  if (!state) {
    return (
      <div className={classes.root}>
        <span className={classes.empty}>No arbiter state yet</span>
      </div>
    );
  }

  const trustLabel = TRUST_LEVEL_LABELS[state.trust_level];

  return (
    <div className={classes.root}>
      {/* Trust level row */}
      <div className={classes.row}>
        <span className={classes.label}>Trust</span>
        <div className={classes.trustWrap}>
          <button
            type="button"
            className={classes.trustBadge}
            onClick={() => setTrustPopoverOpen((v) => !v)}
            aria-expanded={trustPopoverOpen}
            aria-haspopup="true"
          >
            {trustLabel.name}
            <span className={classes.trustCaret} aria-hidden="true">▾</span>
          </button>
          {trustPopoverOpen && (
            <div className={classes.trustPopover} role="dialog" aria-label="Change trust level">
              <TrustLevelSelector
                value={state.trust_level}
                onChange={(level: TrustLevel) => {
                  setTrustLevel(projectId, level);
                  setTrustPopoverOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Loop status row */}
      <div className={classes.row}>
        <span className={classes.label}>Status</span>
        <span className={classes.statusWrap}>
          <span className={`${classes.dot} ${STATUS_DOT_CLASS[state.loop_status]}`} aria-hidden="true" />
          <span className={classes.statusText}>{state.loop_status}</span>
        </span>
      </div>

      {/* Current story row */}
      {state.current_story_id && (
        <div className={classes.row}>
          <span className={classes.label}>Story</span>
          <span className={classes.storyId}>{state.current_story_id}</span>
        </div>
      )}

      {/* Iterations row */}
      <div className={classes.row}>
        <span className={classes.label}>Iterations</span>
        <span className={classes.value}>
          {state.iteration_count} / {state.max_iterations}
        </span>
      </div>

      {/* Last activity row */}
      <div className={classes.row}>
        <span className={classes.label}>Last activity</span>
        <span className={classes.timestamp}>{formatTimestamp(state.last_activity_at)}</span>
      </div>
    </div>
  );
}
