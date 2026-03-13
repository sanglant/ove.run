import { useEffect, useState, useMemo } from "react";
import { Brain, Search } from "lucide-react";
import { SegmentedControl, TextInput, Text } from "@mantine/core";
import { useProjectStore } from "@/stores/projectStore";
import { useMemoryStore } from "@/stores/memoryStore";
import { MemoryCard } from "./MemoryCard";
import { ConsolidationCard } from "./ConsolidationCard";
import classes from "./MemoryPanel.module.css";

type Tab = "memories" | "consolidations";
type VisibilityFilter = "all" | "public" | "private";

const TAB_OPTIONS = [
  { label: "Memories", value: "memories" },
  { label: "Consolidations", value: "consolidations" },
];

const VISIBILITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

export function MemoryPanel() {
  const { activeProjectId } = useProjectStore();
  const { memories, consolidations, loading, loadMemories, loadConsolidations, search, toggleVisibility, removeMemory } = useMemoryStore();

  const [tab, setTab] = useState<Tab>("memories");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

  useEffect(() => {
    if (!activeProjectId) return;
    void loadMemories(activeProjectId);
    void loadConsolidations(activeProjectId);
  }, [activeProjectId, loadMemories, loadConsolidations]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (searchQuery.trim()) {
      void search(searchQuery, activeProjectId);
    } else {
      void loadMemories(activeProjectId);
    }
  }, [searchQuery, activeProjectId, search, loadMemories]);

  const visibleMemories = useMemo(() => {
    if (visibilityFilter === "all") return memories;
    return memories.filter((m) => m.visibility === visibilityFilter);
  }, [memories, visibilityFilter]);

  if (!activeProjectId) {
    return (
      <div className={classes.emptyState}>
        <Brain size={42} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to view agent memories.</p>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.headerTop}>
          <div className={classes.headerTitle}>
            <Brain size={15} className={classes.headerIcon} />
            <h2 className={classes.title}>Memory</h2>
            <span className={classes.countBadge}>
              {tab === "memories" ? memories.length : consolidations.length}
            </span>
          </div>
        </div>

        <SegmentedControl
          data={TAB_OPTIONS}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          size="xs"
          fullWidth
          styles={{
            root: {
              marginTop: 12,
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
            },
            label: { fontSize: 11, fontWeight: 500 },
            indicator: { backgroundColor: "var(--accent)" },
          }}
        />

        {tab === "memories" && (
          <>
            <TextInput
              placeholder="Search memories…"
              leftSection={<Search size={13} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="xs"
              styles={{
                root: { marginTop: 10 },
                input: {
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                },
              }}
              aria-label="Search memories"
            />

            <SegmentedControl
              data={VISIBILITY_OPTIONS}
              value={visibilityFilter}
              onChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
              size="xs"
              fullWidth
              styles={{
                root: {
                  marginTop: 10,
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                },
                label: { fontSize: 11, fontWeight: 500 },
                indicator: { backgroundColor: "var(--bg-elevated)" },
              }}
            />
          </>
        )}
      </div>

      <div className={classes.list} role="list" aria-label={tab === "memories" ? "Memories" : "Consolidations"}>
        {loading ? (
          <div className={classes.listMessage}>Loading…</div>
        ) : tab === "memories" ? (
          visibleMemories.length === 0 ? (
            <div className={classes.listEmpty}>
              <Brain size={28} strokeWidth={1} className={classes.emptyListIcon} />
              <p>{searchQuery ? "No matching memories." : "No memories yet."}</p>
              {!searchQuery && (
                <span>Memories are extracted automatically as agents work.</span>
              )}
            </div>
          ) : (
            <>
              <Text size="xs" c="var(--text-secondary)" className={classes.statsLine}>
                {visibleMemories.length} {visibleMemories.length === 1 ? "memory" : "memories"}
                {visibilityFilter !== "all" ? ` · ${visibilityFilter}` : ""}
              </Text>
              {visibleMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onToggleVisibility={toggleVisibility}
                  onDelete={removeMemory}
                />
              ))}
            </>
          )
        ) : (
          consolidations.length === 0 ? (
            <div className={classes.listEmpty}>
              <Brain size={28} strokeWidth={1} className={classes.emptyListIcon} />
              <p>No consolidations yet.</p>
              <span>Consolidations are created when enough memories accumulate.</span>
            </div>
          ) : (
            <>
              <Text size="xs" c="var(--text-secondary)" className={classes.statsLine}>
                {consolidations.length} {consolidations.length === 1 ? "consolidation" : "consolidations"}
              </Text>
              {consolidations.map((c) => (
                <ConsolidationCard key={c.id} consolidation={c} />
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
