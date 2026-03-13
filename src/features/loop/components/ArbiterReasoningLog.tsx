import { useEffect, useRef } from "react";
import type { ReasoningEntry } from "@/stores/loopStore";
import classes from "./LoopPanel.module.css";

interface ArbiterReasoningLogProps {
  entries: ReasoningEntry[];
}

export function ArbiterReasoningLog({ entries }: ArbiterReasoningLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className={classes.listEmpty}>
        No reasoning entries yet.
      </div>
    );
  }

  return (
    <>
      {entries.map((entry, i) => (
        <article key={i} className={classes.reasoningEntry}>
          <div className={classes.reasoningHeader}>
            <span className={classes.reasoningActionBadge}>{entry.action}</span>
            <span className={classes.reasoningTimestamp}>
              {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className={classes.reasoningText}>{entry.reasoning}</p>
        </article>
      ))}
      <div ref={bottomRef} />
    </>
  );
}
