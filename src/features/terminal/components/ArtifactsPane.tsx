import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useLoopStore } from "@/stores/loopStore";
import type { Story, StoryStatus, GateResult } from "@/types";
import classes from "./ArtifactsPane.module.css";

const DOT_CLASS: Record<StoryStatus, string> = {
  pending: classes.dotPending,
  in_progress: classes.dotInProgress,
  completed: classes.dotCompleted,
  failed: classes.dotFailed,
  skipped: classes.dotSkipped,
};

export function ArtifactsPane() {
  const { stories, status, iterationCount, maxIterations, gateResults, reasoningLog } = useLoopStore();
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const completed = stories.filter((s) => s.status === "completed").length;
  const total = stories.length;
  const activeStory = stories.find((s) => s.status === "in_progress");

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <span className={classes.headerTitle}>Arbiter</span>
          {activeStory && (
            <span className={classes.counter} title={activeStory.title}>
              {activeStory.title.length > 20 ? activeStory.title.slice(0, 20) + "…" : activeStory.title}
            </span>
          )}
        </div>
        <span className={classes.counter}>
          {iterationCount}/{maxIterations} · {completed}/{total} stories
        </span>
      </div>

      <div className={classes.body}>
        {stories.length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionLabel}>Stories</div>
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                expanded={expandedStory === story.id}
                onToggle={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                gates={gateResults[story.id]}
              />
            ))}
          </div>
        )}

        {reasoningLog.length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionLabel}>Reasoning</div>
            {reasoningLog.slice(-10).map((entry, i) => (
              <div key={i} className={classes.reasoningEntry}>
                <span className={classes.reasoningAction}>{entry.action}: </span>
                {entry.reasoning}
              </div>
            ))}
          </div>
        )}

        {stories.length === 0 && (
          <div className={classes.empty}>
            {status === "planning"
              ? "Decomposing request into stories..."
              : status === "running"
              ? "Starting..."
              : status === "failed"
              ? "Loop failed to start"
              : "Waiting for loop to start..."}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryCard({
  story, expanded, onToggle, gates,
}: {
  story: Story;
  expanded: boolean;
  onToggle: () => void;
  gates?: GateResult[];
}) {
  return (
    <div
      className={classes.storyCard}
      data-active={story.status === "in_progress"}
      onClick={onToggle}
    >
      <div className={classes.storyRow}>
        <div className={`${classes.dot} ${DOT_CLASS[story.status]}`} />
        <span className={classes.storyTitle}>{story.title}</span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>

      {!expanded && story.description && (
        <div className={classes.storyDesc}>{story.description}</div>
      )}

      {expanded && (
        <>
          {story.description && (
            <div className={classes.storyDesc} style={{ WebkitLineClamp: "unset" }}>
              {story.description}
            </div>
          )}
          {story.acceptance_criteria && (
            <div className={classes.storyDesc} style={{ WebkitLineClamp: "unset", marginTop: 4 }}>
              <strong>Criteria:</strong> {story.acceptance_criteria}
            </div>
          )}
          {gates && gates.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {gates.map((g, i) => (
                <div key={i} className={classes.gateRow}>
                  {g.passed ? (
                    <CheckCircle size={11} className={classes.gatePass} />
                  ) : (
                    <XCircle size={11} className={classes.gateFail} />
                  )}
                  <span className={classes.gateName}>{g.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
