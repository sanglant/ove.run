import { ExternalLink, Zap } from "lucide-react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { BugItem } from "../types";
import cn from "clsx";
import classes from "./BugDetailView.module.css";

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return classes.statusDone;
  if (s.includes("progress") || s.includes("review") || s.includes("testing")) return classes.statusInProgress;
  if (s.includes("backlog") || s.includes("todo") || s.includes("open")) return classes.statusOpen;
  return classes.statusDefault;
}

function priorityClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "critical" || p === "blocker") return classes.priorityCritical;
  if (p === "high") return classes.priorityHigh;
  if (p === "medium" || p === "normal") return classes.priorityMedium;
  if (p === "low" || p === "minor") return classes.priorityLow;
  return classes.priorityDefault;
}

interface BugDetailViewProps {
  bug: BugItem;
  onDelegate: (prompt: string, label: string) => void;
}

export function BugDetailView({ bug, onDelegate }: BugDetailViewProps) {
  const handleDelegate = () => {
    const prompt = `Fix bug ${bug.key}: ${bug.title}\n\n${bug.description}\n\nReference: ${bug.url}`;
    onDelegate(prompt, `Fix ${bug.key}: ${bug.title}`);
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.headerMeta}>
          <span className={classes.bugKey}>{bug.key}</span>
          <div className={classes.headerActions}>
            <button
              type="button"
              className={classes.externalLink}
              onClick={() => void shellOpen(bug.url)}
              aria-label={`Open ${bug.key} in browser`}
            >
              <ExternalLink size={13} />
              Open in browser
            </button>
            <button
              type="button"
              className={classes.delegateButton}
              onClick={handleDelegate}
              aria-label={`Delegate ${bug.key} to agent`}
              data-tour="bugs-delegate"
            >
              <Zap size={13} />
              Delegate to Agent
            </button>
          </div>
        </div>
        <h2 className={classes.title}>{bug.title}</h2>
        <div className={classes.metaRow}>
          <span className={cn(classes.statusBadge, statusClass(bug.status))}>
            {bug.status}
          </span>
          {bug.priority && (
            <span className={cn(classes.priorityBadge, priorityClass(bug.priority))}>
              {bug.priority}
            </span>
          )}
          {bug.assignee && (
            <span className={classes.assignee}>
              <span className={classes.assigneeAvatar}>
                {bug.assignee.charAt(0).toUpperCase()}
              </span>
              {bug.assignee}
            </span>
          )}
        </div>
        {bug.labels.length > 0 && (
          <div className={classes.labels}>
            {bug.labels.map((label) => (
              <span key={label} className={classes.label}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={classes.body}>
        {bug.description ? (
          <pre className={classes.description}>{bug.description}</pre>
        ) : (
          <p className={classes.noDescription}>No description provided.</p>
        )}
      </div>

      <div className={classes.footer}>
        <span className={classes.footerMeta}>
          Created {new Date(bug.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <span className={classes.footerSep} aria-hidden="true" />
        <span className={classes.footerMeta}>
          Updated {new Date(bug.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
