import { useEffect, useState, useMemo } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { SegmentedControl, TextInput, Modal, Text } from "@mantine/core";
import { useProjectStore } from "@/stores/projectStore";
import { useContextStore } from "@/stores/contextStore";
import { useSessionStore } from "@/stores/sessionStore";
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
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
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
  const { units, loading, filter, searchQuery, setFilter, setSearchQuery, loadUnits, addUnit, editUnit, removeUnit } = useContextStore();
  const { sessions, activeSessionId } = useSessionStore();

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

  const handleGenerateSummary = (unit: ContextUnit) => {
    if (!activeProject) return;
    void generateContextSummary(unit.id, activeProject.path).catch((err) => {
      console.error("Failed to generate summary:", err);
    });
  };

  if (!activeProjectId) {
    return (
      <div className={classes.emptyState}>
        <BookOpen size={42} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to manage context units.</p>
      </div>
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
            aria-label="Add context unit"
            title="Add context unit"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        <TextInput
          placeholder="Search context units…"
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
          aria-label="Search context units"
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
      </div>

      <div className={classes.list} role="list" aria-label="Context units">
        {loading ? (
          <div className={classes.listMessage}>Loading context units…</div>
        ) : visibleUnits.length === 0 ? (
          <div className={classes.listEmpty}>
            <BookOpen size={28} strokeWidth={1} className={classes.emptyListIcon} />
            <p>{searchQuery || filter !== "all" ? "No matching context units." : "No context units yet."}</p>
            {!searchQuery && filter === "all" && (
              <span>Add a persona, skill, knowledge block, or reference.</span>
            )}
          </div>
        ) : (
          visibleUnits.map((unit) => (
            <ContextUnitCard
              key={unit.id}
              unit={unit}
              onEdit={handleOpenEdit}
              onDelete={setPendingDelete}
              onGenerateSummary={handleGenerateSummary}
              isDefault={defaultUnitIds.has(unit.id)}
              isGlobalDefault={unit.scope === "global"}
              onSetDefault={handleSetDefault}
              onRemoveDefault={handleRemoveDefault}
            />
          ))
        )}
      </div>

      <ContextUnitEditor
        opened={editorOpen}
        unit={editingUnit}
        projectId={activeProjectId}
        onSave={handleSave}
        onClose={() => setEditorOpen(false)}
      />

      <Modal
        opened={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete context unit"
        centered
        size="sm"
        overlayProps={MODAL_OVERLAY_PROPS}
        styles={{
          ...MODAL_STYLES,
          body: { ...MODAL_STYLES.body, padding: 20 },
        }}
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
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
