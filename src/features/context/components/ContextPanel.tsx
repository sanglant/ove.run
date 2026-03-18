import { useEffect, useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpen, Plus, Search } from "lucide-react";
import { SegmentedControl, TextInput, Text } from "@mantine/core";
import { AppModal } from "@/components/ui/AppModal";
import { useProjectStore } from "@/stores/projectStore";
import { useContextStore } from "@/stores/contextStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useAutoTour } from "@/hooks/useAutoTour";
import {
  generateContextSummary,
  setProjectDefaultContext,
  removeProjectDefaultContext,
  listProjectDefaultContext,
} from "@/lib/tauri";
import type { ContextUnit, ContextUnitType } from "@/types";
import { ContextUnitCard } from "./ContextUnitCard";
import { ContextUnitEditor } from "./ContextUnitEditor";
import { ContextAssignments } from "./ContextAssignments";
import { ArbiterContextInput } from "./ArbiterContextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import classes from "./ContextPanel.module.css";

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Personas", value: "persona" },
  { label: "Skills", value: "skill" },
  { label: "Knowledge", value: "knowledge" },
  { label: "References", value: "reference" },
];

export function ContextPanel() {
  const { activeProjectId, projects } = useProjectStore();
  const { units, loading, filter, searchQuery, setFilter, setSearchQuery, loadUnits, addUnit, editUnit, removeUnit, duplicateUnit } = useContextStore();
  const { sessions, activeSessionId } = useSessionStore();

  useAutoTour("knowledge");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ContextUnit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContextUnit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [defaultUnitIds, setDefaultUnitIds] = useState<Set<string>>(new Set());

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null;

  // Active session scoped to the active project
  const activeSession = useMemo(() => {
    if (!activeSessionId || !activeProjectId) return null;
    const s = sessions.find((s) => s.id === activeSessionId);
    return s?.projectId === activeProjectId ? s : null;
  }, [sessions, activeSessionId, activeProjectId]);

  useEffect(() => {
    void loadUnits(activeProjectId ?? undefined);
  }, [activeProjectId, loadUnits]);

  useEffect(() => {
    if (!activeProjectId) {
      setDefaultUnitIds(new Set());
      return;
    }
    listProjectDefaultContext(activeProjectId).then((defaults) => {
      const explicitDefaultIds = new Set(defaults.map((d) => d.id));
      // Global-scope units are enabled by default. Auto-register any
      // global unit that isn't already in the project defaults table.
      const globalUnits = units.filter((u) => u.scope === "global");
      const allDefaultIds = new Set(explicitDefaultIds);

      for (const gu of globalUnits) {
        if (!explicitDefaultIds.has(gu.id)) {
          setProjectDefaultContext(gu.id, activeProjectId).catch(() => {});
          allDefaultIds.add(gu.id);
        }
      }

      setDefaultUnitIds(allDefaultIds);
    }).catch((err) => {
      console.error("Failed to load project defaults:", err);
    });
  }, [activeProjectId, units]);

  const visibleUnits = useMemo(() => {
    let result = units;
    if (filter !== "all") {
      result = result.filter((u) => u.type === (filter as ContextUnitType));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.l0_summary?.toLowerCase().includes(q) ?? false) ||
          (u.l2_content?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [units, filter, searchQuery]);

  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: visibleUnits.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (unit: ContextUnit) => {
    setEditingUnit(unit);
    setEditorOpen(true);
  };

  const handleSave = async (unit: ContextUnit) => {
    if (editingUnit) {
      await editUnit(unit);
    } else {
      await addUnit(unit);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeUnit(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      console.error("Failed to delete context unit:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = (unit: ContextUnit) => {
    if (!activeProjectId) return;
    setProjectDefaultContext(unit.id, activeProjectId).then(() => {
      setDefaultUnitIds((prev) => new Set([...prev, unit.id]));
    }).catch((err) => {
      console.error("Failed to set project default:", err);
    });
  };

  const handleRemoveDefault = (unit: ContextUnit) => {
    if (!activeProjectId) return;
    removeProjectDefaultContext(unit.id, activeProjectId).then(() => {
      setDefaultUnitIds((prev) => {
        const next = new Set(prev);
        next.delete(unit.id);
        return next;
      });
    }).catch((err) => {
      console.error("Failed to remove project default:", err);
    });
  };

  const handleDuplicate = async (unit: ContextUnit) => {
    await duplicateUnit(unit);
  };

  const handleGenerateSummary = (unit: ContextUnit) => {
    if (!activeProject) return;
    void generateContextSummary(unit.id, activeProject.path).catch((err) => {
      console.error("Failed to generate summary:", err);
    });
  };

  const handleArbiterGenerated = (unit: ContextUnit) => {
    setEditingUnit(unit);
    setEditorOpen(true);
  };

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={<BookOpen size={40} strokeWidth={1} />}
        title="Select a project to manage context"
      />
    );
  }

  return (
    <div className={classes.root}>
      {activeSession && activeProjectId && (
        <ContextAssignments
          sessionId={activeSession.id}
          projectId={activeProjectId}
          allUnits={units}
        />
      )}
      <div className={classes.header}>
        <div className={classes.headerTop}>
          <div className={classes.headerTitle}>
            <BookOpen size={15} className={classes.headerIcon} />
            <h2 className={classes.title}>Context</h2>
            <span className={classes.countBadge}>{units.length}</span>
          </div>
          <button
            type="button"
            className={classes.addButton}
            onClick={handleOpenCreate}
            aria-label="Add context entry"
            title="Add context entry"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        <TextInput
          placeholder="Search context…"
          leftSection={<Search size={13} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="xs"
          styles={{
            root: { marginTop: 12 },
            input: {
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              fontSize: 12,
            },
          }}
          aria-label="Search context"
        />

        <SegmentedControl
          data={FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as ContextUnitType | "all")}
          size="xs"
          fullWidth
          styles={{
            root: {
              marginTop: 10,
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
            },
            label: { fontSize: 11, fontWeight: 500 },
            indicator: { backgroundColor: "var(--accent)" },
          }}
        />

        {activeProject && (
          <ArbiterContextInput
            projectPath={activeProject.path}
            projectId={activeProjectId}
            onGenerated={handleArbiterGenerated}
          />
        )}
      </div>

      <div className={classes.list} role="list" aria-label="Context entries" ref={listRef}>
        {loading ? (
          <div className={classes.listMessage}>Loading context…</div>
        ) : visibleUnits.length === 0 ? (
          <div className={classes.listEmpty}>
            <BookOpen size={28} strokeWidth={1} className={classes.emptyListIcon} />
            <p>{searchQuery || filter !== "all" ? "No matches." : "No context yet."}</p>
            {!searchQuery && filter === "all" && (
              <span>Add a persona, skill, knowledge entry, or reference.</span>
            )}
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const unit = visibleUnits[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: 10,
                  }}
                >
                  <ContextUnitCard
                    unit={unit}
                    onEdit={handleOpenEdit}
                    onDelete={setPendingDelete}
                    onGenerateSummary={handleGenerateSummary}
                    onDuplicate={handleDuplicate}
                    isDefault={defaultUnitIds.has(unit.id)}
                    isGlobalDefault={unit.scope === "global"}
                    onSetDefault={handleSetDefault}
                    onRemoveDefault={handleRemoveDefault}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ContextUnitEditor
        opened={editorOpen}
        unit={editingUnit}
        projectId={activeProjectId}
        onSave={handleSave}
        onClose={() => setEditorOpen(false)}
      />

      <AppModal
        opened={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete context entry"
        centered
        size="sm"
        bodyPadding={20}
      >
        <Text size="sm" c="var(--text-secondary)" mb="md">
          Delete "{pendingDelete?.name}"? This cannot be undone.
        </Text>
        <div className={classes.modalActions}>
          <button
            type="button"
            className={classes.secondaryButton}
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={classes.dangerButton}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete entry"}
          </button>
        </div>
      </AppModal>
    </div>
  );
}
