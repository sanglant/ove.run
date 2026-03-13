import { Badge, ActionIcon, Tooltip, Text } from "@mantine/core";
import { Trash2, CheckCircle } from "lucide-react";
import type { Memory } from "@/types";
import classes from "./MemoryPanel.module.css";

interface MemoryCardProps {
  memory: Memory;
  onToggleVisibility: (id: string, visibility: "private" | "public") => void;
  onDelete: (id: string) => void;
}

function importanceLabel(importance: number): { label: string; color: string } {
  if (importance >= 0.7) return { label: "high", color: "green" };
  if (importance >= 0.4) return { label: "med", color: "yellow" };
  return { label: "low", color: "red" };
}

function parseJsonTags(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function MemoryCard({ memory, onToggleVisibility, onDelete }: MemoryCardProps) {
  const imp = importanceLabel(memory.importance);
  const entities = parseJsonTags(memory.entities_json);
  const topics = parseJsonTags(memory.topics_json);
  const isPublic = memory.visibility === "public";

  return (
    <div className={classes.card}>
      <div className={classes.cardHeader}>
        <div className={classes.cardBadgeRow}>
          <Badge size="xs" color={imp.color} variant="light" styles={{ root: { textTransform: "none", fontWeight: 700 } }}>
            {imp.label}
          </Badge>
          {memory.consolidated && (
            <Tooltip label="Consolidated into a summary" position="top" withArrow>
              <span className={classes.consolidatedBadge} aria-label="Consolidated">
                <CheckCircle size={11} />
              </span>
            </Tooltip>
          )}
        </div>

        <div className={classes.cardActions}>
          <Tooltip label={isPublic ? "Set private" : "Set public"} position="top" withArrow>
            <button
              type="button"
              className={`${classes.visibilityButton} ${isPublic ? classes.visibilityPublic : classes.visibilityPrivate}`}
              onClick={() => onToggleVisibility(memory.id, isPublic ? "private" : "public")}
              aria-label={isPublic ? "Set private" : "Set public"}
            >
              {isPublic ? "public" : "private"}
            </button>
          </Tooltip>
          <Tooltip label="Delete memory" position="top" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => onDelete(memory.id)}
              aria-label="Delete memory"
              styles={{ root: { color: "var(--danger)" } }}
            >
              <Trash2 size={12} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <Text size="xs" c="var(--text-primary)" className={classes.cardContent}>
        {memory.content}
      </Text>

      {(entities.length > 0 || topics.length > 0) && (
        <div className={classes.cardTags}>
          {entities.map((e) => (
            <span key={`e-${e}`} className={classes.tagEntity}>{e}</span>
          ))}
          {topics.map((t) => (
            <span key={`t-${t}`} className={classes.tagTopic}>{t}</span>
          ))}
        </div>
      )}

      <span className={classes.cardTimestamp}>{formatDate(memory.created_at)}</span>
    </div>
  );
}
