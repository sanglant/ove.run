import { useState } from "react";
import { Badge, ActionIcon, Collapse, Text, Tooltip, Switch } from "@mantine/core";
import { Pencil, Trash2, Sparkles, ChevronDown, ChevronRight, Star, Copy } from "lucide-react";
import type { ContextUnit, ContextUnitType } from "@/types";
import classes from "./ContextPanel.module.css";

const TYPE_COLORS: Record<ContextUnitType, string> = {
  persona: "blue",
  skill: "green",
  knowledge: "yellow",
  reference: "gray",
};

const TYPE_LABELS: Record<ContextUnitType, string> = {
  persona: "Persona",
  skill: "Skill",
  knowledge: "Knowledge",
  reference: "Reference",
};

interface ContextUnitCardProps {
  unit: ContextUnit;
  onEdit: (unit: ContextUnit) => void;
  onDelete: (unit: ContextUnit) => void;
  onGenerateSummary: (unit: ContextUnit) => void;
  onDuplicate?: (unit: ContextUnit) => void;
  isDefault?: boolean;
  isGlobalDefault?: boolean;
  onSetDefault?: (unit: ContextUnit) => void;
  onRemoveDefault?: (unit: ContextUnit) => void;
}

export function ContextUnitCard({ unit, onEdit, onDelete, onGenerateSummary, onDuplicate, isDefault, isGlobalDefault, onSetDefault, onRemoveDefault }: ContextUnitCardProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);

  const tags: string[] = (() => {
    try {
      return JSON.parse(unit.tags_json) as string[];
    } catch {
      return [];
    }
  })();

  return (
    <div className={classes.card}>
      <div className={classes.cardHeader}>
        <div className={classes.cardTitleRow}>
          <span className={classes.cardName}>{unit.name}</span>
          <div className={classes.cardBadges}>
            <Badge
              size="xs"
              color={TYPE_COLORS[unit.type]}
              variant="light"
              styles={{ root: { textTransform: "none", fontWeight: 600 } }}
            >
              {TYPE_LABELS[unit.type]}
            </Badge>
            <Badge
              size="xs"
              color={unit.scope === "global" ? "violet" : "cyan"}
              variant="outline"
              styles={{ root: { textTransform: "none" } }}
            >
              {unit.scope}
            </Badge>
            {unit.is_bundled && (
              <Badge
                size="xs"
                color="gray"
                variant="filled"
                styles={{ root: { textTransform: "none" } }}
              >
                Built-in
              </Badge>
            )}
          </div>
        </div>

        <div className={classes.cardActions}>
          {isGlobalDefault ? (
            <Tooltip label={isDefault ? "Disable default context" : "Enable default context"} position="top" withArrow>
              <Switch
                checked={isDefault}
                onChange={() => isDefault ? onRemoveDefault?.(unit) : onSetDefault?.(unit)}
                size="xs"
                aria-label={isDefault ? "Disable default context" : "Enable default context"}
                styles={{
                  track: { cursor: "pointer" },
                }}
              />
            </Tooltip>
          ) : (onSetDefault ?? onRemoveDefault) ? (
            <Tooltip label={isDefault ? "Remove project default" : "Set as project default"} position="top" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => isDefault ? onRemoveDefault?.(unit) : onSetDefault?.(unit)}
                aria-label={isDefault ? "Remove project default" : "Set as project default"}
                styles={{ root: { color: isDefault ? "var(--accent)" : "var(--text-secondary)" } }}
              >
                <Star size={13} fill={isDefault ? "currentColor" : "none"} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {!unit.is_bundled && !unit.l0_summary && (
            <Tooltip label="Generate summary" position="top" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => onGenerateSummary(unit)}
                aria-label="Generate summary"
                styles={{ root: { color: "var(--text-secondary)" } }}
              >
                <Sparkles size={13} />
              </ActionIcon>
            </Tooltip>
          )}
          {unit.is_bundled ? (
            <Tooltip label="Duplicate to customize" position="top" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => onDuplicate?.(unit)}
                aria-label={`Duplicate ${unit.name}`}
                styles={{ root: { color: "var(--text-secondary)" } }}
              >
                <Copy size={13} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Edit" position="top" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => onEdit(unit)}
                aria-label={`Edit ${unit.name}`}
                styles={{ root: { color: "var(--text-secondary)" } }}
              >
                <Pencil size={13} />
              </ActionIcon>
            </Tooltip>
          )}
          {!unit.is_bundled && !isGlobalDefault && (
            <Tooltip label="Delete" position="top" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => onDelete(unit)}
                aria-label={`Delete ${unit.name}`}
                styles={{ root: { color: "var(--danger)" } }}
              >
                <Trash2 size={13} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className={classes.cardTags}>
          {tags.map((tag) => (
            <span key={tag} className={classes.tag}>{tag}</span>
          ))}
        </div>
      )}

      {unit.l0_summary && (
        <Text size="xs" c="var(--text-secondary)" className={classes.cardSummary}>
          {unit.l0_summary}
        </Text>
      )}

      {unit.l1_overview && (
        <div className={classes.cardSection}>
          <button
            type="button"
            className={classes.sectionToggle}
            onClick={() => setOverviewOpen((v) => !v)}
            aria-expanded={overviewOpen}
          >
            {overviewOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Overview</span>
          </button>
          <Collapse in={overviewOpen}>
            <Text size="xs" c="var(--text-secondary)" className={classes.sectionContent}>
              {unit.l1_overview}
            </Text>
          </Collapse>
        </div>
      )}

      {unit.l2_content && (
        <div className={classes.cardSection}>
          <button
            type="button"
            className={classes.sectionToggle}
            onClick={() => setContentOpen((v) => !v)}
            aria-expanded={contentOpen}
          >
            {contentOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Full content</span>
          </button>
          <Collapse in={contentOpen}>
            <pre className={classes.sectionPre}>{unit.l2_content}</pre>
          </Collapse>
        </div>
      )}
    </div>
  );
}
