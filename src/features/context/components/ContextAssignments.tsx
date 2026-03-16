import { useEffect, useState, useMemo } from "react";
import { ActionIcon, Select, Tooltip, Text } from "@mantine/core";
import { X, Plus, Star } from "lucide-react";
import type { ContextUnit } from "@/types";
import {
  listSessionContext,
  assignContext,
  unassignContext,
  listProjectDefaultContext,
} from "@/lib/tauri";
import classes from "./ContextPanel.module.css";

interface ContextAssignmentsProps {
  sessionId: string;
  projectId: string;
  allUnits: ContextUnit[];
}

export function ContextAssignments({ sessionId, projectId, allUnits }: ContextAssignmentsProps) {
  const [assigned, setAssigned] = useState<ContextUnit[]>([]);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadAssigned = async () => {
    try {
      const units = await listSessionContext(sessionId);
      setAssigned(units);
    } catch (err) {
      console.error("Failed to load session context:", err);
    }
  };

  useEffect(() => {
    void loadAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const assignedIds = useMemo(() => new Set(assigned.map((u) => u.id)), [assigned]);

  const selectOptions = useMemo(
    () =>
      allUnits
        .filter((u) => !assignedIds.has(u.id))
        .map((u) => ({ value: u.id, label: u.name })),
    [allUnits, assignedIds],
  );

  const handleAssign = async (unitId: string | null) => {
    if (!unitId) return;
    setAssigning(true);
    try {
      await assignContext(unitId, sessionId);
      const unit = allUnits.find((u) => u.id === unitId);
      if (unit) {
        setAssigned((prev) => [...prev, unit]);
      }
    } catch (err) {
      console.error("Failed to assign context unit:", err);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (unitId: string) => {
    try {
      await unassignContext(unitId, sessionId);
      setAssigned((prev) => prev.filter((u) => u.id !== unitId));
    } catch (err) {
      console.error("Failed to unassign context unit:", err);
    }
  };

  const handleApplyDefaults = async () => {
    setApplyingDefaults(true);
    try {
      const defaults = await listProjectDefaultContext(projectId);
      const toAssign = defaults.filter((d) => !assignedIds.has(d.id));
      await Promise.all(toAssign.map((d) => assignContext(d.id, sessionId)));
      await loadAssigned();
    } catch (err) {
      console.error("Failed to apply project defaults:", err);
    } finally {
      setApplyingDefaults(false);
    }
  };

  return (
    <div className={classes.assignmentsSection}>
      <div className={classes.assignmentsHeader}>
        <span className={classes.assignmentsLabel}>Session context</span>
        <button
          type="button"
          className={classes.secondaryButton}
          style={{ height: 24, padding: "0 9px", fontSize: 11 }}
          onClick={() => void handleApplyDefaults()}
          disabled={applyingDefaults}
          title="Apply project defaults to this session"
        >
          <Star size={10} style={{ marginRight: 3, display: "inline-block", verticalAlign: "middle" }} />
          {applyingDefaults ? "Applying…" : "Defaults"}
        </button>
      </div>

      {assigned.length > 0 && (
        <div className={classes.assignedList}>
          {assigned.map((unit) => (
            <div key={unit.id} className={classes.assignedItem}>
              <Text
                size="xs"
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {unit.name}
              </Text>
              <Tooltip label="Unassign" position="top" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  onClick={() => void handleUnassign(unit.id)}
                  aria-label={`Unassign ${unit.name}`}
                  styles={{ root: { color: "var(--text-secondary)" } }}
                >
                  <X size={11} />
                </ActionIcon>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {assigned.length === 0 && (
        <Text size="xs" c="var(--text-secondary)" style={{ fontStyle: "italic", padding: "2px 0 6px" }}>
          No context assigned.
        </Text>
      )}

      <Select
        placeholder="Assign context…"
        data={selectOptions}
        value={null}
        onChange={(v) => void handleAssign(v)}
        size="xs"
        searchable
        disabled={assigning || selectOptions.length === 0}
        styles={{
          input: {
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            fontSize: 11,
          },
        }}
        aria-label="Assign context to session"
        leftSection={<Plus size={11} />}
        comboboxProps={{ withinPortal: true }}
      />
    </div>
  );
}
