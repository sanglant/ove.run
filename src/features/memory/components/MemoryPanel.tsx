import { useEffect, useState } from "react";
import { Brain, Search } from "lucide-react";
import { SegmentedControl, TextInput, Text } from "@mantine/core";
import { useProjectStore } from "@/stores/projectStore";
import { useMemoryStore } from "@/stores/memoryStore";
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
          </>
        )}
      </div>

      <div className={classes.list} role="list" aria-label={tab === "memories" ? "Memories" : "Summaries"}>
        {loading ? (
          <div className={classes.listMessage}>Loading memories…</div>
        ) : tab === "memories" ? (
          memories.length === 0 ? (
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
                {memories.length} {memories.length === 1 ? "memory" : "memories"}
              </Text>
              {memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onDelete={removeMemory}
                />
              ))}
            </>
          )
        ) : (
          consolidations.length === 0 ? (
            <div className={classes.listEmpty}>
              <Brain size={28} strokeWidth={1} className={classes.emptyListIcon} />
              <p>No summaries yet.</p>
              <span>As memories build up, they're summarized into concise takeaways.</span>
            </div>
          ) : (
            <>
              <Text size="xs" c="var(--text-secondary)" className={classes.statsLine}>
                {consolidations.length} {consolidations.length === 1 ? "summary" : "summaries"}
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
