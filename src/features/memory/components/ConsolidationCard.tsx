import { Text } from "@mantine/core";
import { Layers } from "lucide-react";
import type { Consolidation } from "@/types";
import classes from "./MemoryPanel.module.css";

interface ConsolidationCardProps {
  consolidation: Consolidation;
}

function sourceCount(json: string): number {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed.length;
    return 0;
  } catch {
    return 0;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ConsolidationCard({ consolidation }: ConsolidationCardProps) {
  const count = sourceCount(consolidation.source_ids_json);

  return (
    <div className={classes.card}>
      <div className={classes.cardHeader}>
        <div className={classes.cardBadgeRow}>
          <span className={classes.consolidationSourceBadge}>
            <Layers size={10} />
            {count} {count === 1 ? "source" : "sources"}
          </span>
        </div>
        <span className={classes.cardTimestamp}>{formatDate(consolidation.created_at)}</span>
      </div>

      <Text size="xs" c="var(--text-primary)" className={classes.cardContent}>
        {consolidation.summary}
      </Text>

      <div className={classes.insightBlock}>
        <span className={classes.insightLabel}>Insight</span>
        <Text size="xs" c="var(--accent-glow)" className={classes.insightText}>
          {consolidation.insight}
        </Text>
      </div>
    </div>
  );
}
