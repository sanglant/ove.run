import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Story, StoryStatus } from "@/types";
import classes from "./LoopPanel.module.css";

const STATUS_DOT_CLASS: Record<StoryStatus, string> = {
  pending: classes.dotPending,
  in_progress: classes.dotInProgress,
  completed: classes.dotCompleted,
  failed: classes.dotFailed,
  skipped: classes.dotSkipped,
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
};

interface StoryCardProps {
  story: Story;
}

function StoryCard({ story }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={`${classes.storyCard} ${story.status === "in_progress" ? classes.storyCardActive : ""}`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
      }}
    >
      <div className={classes.storyRow}>
        <div className={`${classes.dot} ${STATUS_DOT_CLASS[story.status]}`} aria-label={`Status: ${story.status}`} />
        <span className={classes.storyTitle}>{story.title}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </div>

      {!expanded && story.description && (
        <p className={classes.storyDescription}>
          {story.description.length > 80 ? story.description.slice(0, 80) + "…" : story.description}
        </p>
      )}

      <div className={classes.storyMeta}>
        <span className={classes.priorityBadge}>
          {PRIORITY_LABEL[story.priority] ?? `P${story.priority}`}
        </span>
        {story.iteration_attempts > 0 && (
          <span className={classes.attemptBadge}>
            {story.iteration_attempts} {story.iteration_attempts === 1 ? "attempt" : "attempts"}
          </span>
        )}
      </div>

      {expanded && (
        <>
          {story.description && (
            <p className={classes.storyDescription}>{story.description}</p>
          )}
          {story.acceptance_criteria && (
            <pre className={classes.storyCriteria}>{story.acceptance_criteria}</pre>
          )}
        </>
      )}
    </article>
  );
}

interface StoryListProps {
  stories: Story[];
}

export function StoryList({ stories }: StoryListProps) {
  if (stories.length === 0) {
    return (
      <div className={classes.listEmpty}>
        No stories yet. Start the loop with a request.
      </div>
    );
  }

  return (
    <>
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </>
  );
}
