import { useEffect, useRef, useState } from "react";
import { Brain, Search } from "lucide-react";
import { SegmentedControl, TextInput, Text } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useProjectStore } from "@/stores/projectStore";
import { useMemoryStore } from "@/stores/memoryStore";
import { useAutoTour } from "@/hooks/useAutoTour";
import { MemoryCard } from "./MemoryCard";
import { ConsolidationCard } from "./ConsolidationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import classes from "./MemoryPanel.module.css";

type Tab = "memories" | "consolidations";

const TAB_OPTIONS = [
  { label: "Memories", value: "memories" },
  { label: "Summaries", value: "consolidations" },
];

export function MemoryPanel() {
  const { activeProjectId } = useProjectStore();
  const { memories, consolidations, loading, loadMemories, loadConsolidations, search, removeMemory } = useMemoryStore();

  const [tab, setTab] = useState<Tab>("memories");
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useAutoTour("memory");

  const items = tab === "memories" ? memories : consolidations;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  useEffect(() => {
    if (!activeProjectId) return;
    if (searchQuery.trim()) {
      void search(searchQuery, activeProjectId);
    } else {
      void loadMemories(activeProjectId);
    }
    void loadConsolidations(activeProjectId);
  }, [activeProjectId, searchQuery, search, loadMemories, loadConsolidations]);

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={<Brain size={40} strokeWidth={1} />}
        title="Select a project to view agent memories"
        description="Memories are extracted automatically as agents work"
      />
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
              {items.length}
            </span>
          </div>
        </div>

        <SegmentedControl
          data={TAB_OPTIONS}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          size="xs"
          fullWidth
          data-tour="memory-tabs"
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
              data-tour="memory-search"
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
          </>
        )}
      </div>

      <div
        ref={listRef}
        className={classes.list}
        role="list"
        aria-label={tab === "memories" ? "Memories" : "Summaries"}
        data-tour="memory-list"
      >
        {loading ? (
          <div className={classes.listMessage}>Loading memories…</div>
        ) : items.length === 0 ? (
          <div className={classes.listEmpty}>
            <Brain size={28} strokeWidth={1} className={classes.emptyListIcon} />
            {tab === "memories" ? (
              <>
                <p>{searchQuery ? "No matching memories." : "No memories yet."}</p>
                {!searchQuery && <span>Memories are extracted automatically as agents work.</span>}
              </>
            ) : (
              <>
                <p>No summaries yet.</p>
                <span>As memories build up, they're summarized into concise takeaways.</span>
              </>
            )}
          </div>
        ) : (
          <>
            <Text size="xs" c="var(--text-secondary)" className={classes.statsLine}>
              {tab === "memories"
                ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`
                : `${consolidations.length} ${consolidations.length === 1 ? "summary" : "summaries"}`}
            </Text>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => (
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
                  {tab === "memories" ? (
                    <MemoryCard
                      memory={memories[virtualRow.index]}
                      onDelete={removeMemory}
                    />
                  ) : (
                    <ConsolidationCard consolidation={consolidations[virtualRow.index]} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
