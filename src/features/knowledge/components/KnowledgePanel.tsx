import { useState, useEffect } from "react";
import { Plus, Trash2, BookOpen, FileText, StickyNote, Cpu } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import {
  listKnowledge,
  createKnowledge,
  readKnowledgeContent,
  updateKnowledge,
  deleteKnowledge,
} from "@/lib/tauri";
import { KnowledgeEditor } from "./KnowledgeEditor";
import type { KnowledgeEntry, KnowledgeType } from "@/types";
import { TextInput, Select, Button, Group } from "@mantine/core";
import classes from "./KnowledgePanel.module.css";

const TYPE_ICONS: Record<KnowledgeType, React.ReactNode> = {
  system_prompt: <Cpu size={12} />,
  context_file: <FileText size={12} />,
  notes: <StickyNote size={12} />,
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  system_prompt: "System Prompts",
  context_file: "Context Files",
  notes: "Notes",
};

const KNOWLEDGE_TYPES: KnowledgeType[] = ["system_prompt", "context_file", "notes"];

interface NewEntryForm {
  name: string;
  type: KnowledgeType;
}

const inputStyles = {
  input: {
    backgroundColor: "var(--bg-secondary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    fontSize: "12px",
  },
};

export function KnowledgePanel() {
  const { activeProjectId } = useProjectStore();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<NewEntryForm>({
    name: "",
    type: "notes",
  });
  const [creating, setCreating] = useState(false);

  const loadEntries = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const data = await listKnowledge(activeProjectId);
      setEntries(data);
    } catch (err) {
      console.error("Failed to load knowledge:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeProjectId) {
      setEntries([]);
      setSelectedEntry(null);
      return;
    }
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const handleSelectEntry = async (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    try {
      const content = await readKnowledgeContent(
        activeProjectId ?? "",
        entry.id,
      );
      setEditorContent(content);
    } catch {
      setEditorContent("");
    }
  };

  const handleSave = async (content: string) => {
    if (!selectedEntry || !activeProjectId) return;
    await updateKnowledge(activeProjectId, selectedEntry.id, content);
    setEditorContent(content);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === selectedEntry.id
          ? { ...e, updated_at: new Date().toISOString() }
          : e,
      ),
    );
  };

  const handleDelete = async (entry: KnowledgeEntry) => {
    if (!activeProjectId) return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    try {
      await deleteKnowledge(activeProjectId, entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null);
        setEditorContent("");
      }
    } catch (err) {
      console.error("Failed to delete knowledge entry:", err);
    }
  };

  const handleCreate = async () => {
    if (!activeProjectId || !newForm.name.trim()) return;
    setCreating(true);
    try {
      const entry = await createKnowledge(
        activeProjectId,
        newForm.name.trim(),
        newForm.type,
        "",
      );
      setEntries((prev) => [...prev, entry]);
      setShowNewForm(false);
      setNewForm({ name: "", type: "notes" });
      handleSelectEntry(entry);
    } catch (err) {
      console.error("Failed to create knowledge entry:", err);
    } finally {
      setCreating(false);
    }
  };

  if (!activeProjectId) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Select a project to view knowledge base
      </div>
    );
  }

  const grouped = KNOWLEDGE_TYPES.reduce(
    (acc, type) => {
      acc[type] = entries.filter((e) => e.content_type === type);
      return acc;
    },
    {} as Record<KnowledgeType, KnowledgeEntry[]>,
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: Entry list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "240px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Group gap={8} wrap="nowrap">
            <BookOpen size={14} color="var(--accent)" />
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Knowledge
            </span>
          </Group>
          <button
            onClick={() => setShowNewForm(true)}
            aria-label="New knowledge entry"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: 0,
              display: "flex",
              alignItems: "center",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            <Plus size={14} />
          </button>
        </div>

        {/* New entry form */}
        {showNewForm && (
          <div
            style={{
              padding: "12px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <TextInput
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Entry name..."
              autoFocus
              styles={inputStyles}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowNewForm(false);
              }}
            />
            <Select
              data={KNOWLEDGE_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
              value={newForm.type}
              onChange={(v) =>
                setNewForm((f) => ({ ...f, type: (v ?? "notes") as KnowledgeType }))
              }
              styles={{
                input: {
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                },
                dropdown: {
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border)",
                },
                option: {
                  fontSize: "12px",
                  "&[data-selected]": { backgroundColor: "var(--accent)" },
                },
              }}
            />
            <Group gap={6} grow>
              <Button
                onClick={handleCreate}
                disabled={creating || !newForm.name.trim()}
                size="xs"
                styles={{
                  root: {
                    backgroundColor: "var(--accent)",
                    color: "var(--bg-primary)",
                    "&:hover": { backgroundColor: "var(--accent-hover)" },
                    "&:disabled": { opacity: 0.4 },
                  },
                }}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="default"
                size="xs"
                onClick={() => setShowNewForm(false)}
                styles={{
                  root: {
                    backgroundColor: "transparent",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "var(--text-primary)",
                    },
                  },
                }}
              >
                Cancel
              </Button>
            </Group>
          </div>
        )}

        {/* Grouped entries */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              <BookOpen
                size={24}
                style={{ margin: "0 auto 8px", display: "block", opacity: 0.4 }}
              />
              No knowledge entries
            </div>
          ) : (
            KNOWLEDGE_TYPES.map((type) => {
              const typeEntries = grouped[type];
              if (typeEntries.length === 0) return null;
              return (
                <div key={type}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {TYPE_ICONS[type]}
                    {TYPE_LABELS[type]}
                  </div>
                  {typeEntries.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={classes.row}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "var(--bg-tertiary)"
                            : "transparent",
                          color: isSelected
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                          transition: "background-color 150ms, color 150ms",
                        }}
                        onClick={() => handleSelectEntry(entry)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSelectEntry(entry);
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor =
                              "var(--bg-tertiary)";
                            e.currentTarget.style.color = "var(--text-primary)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "var(--text-secondary)";
                          }
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: "12px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry);
                          }}
                          aria-label={`Delete ${entry.name}`}
                          className={classes.revealOnHover}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--danger)",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Editor */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {selectedEntry ? (
          <KnowledgeEditor
            entry={selectedEntry}
            content={editorContent}
            onSave={handleSave}
            onCancel={() => {
              setSelectedEntry(null);
              setEditorContent("");
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <BookOpen size={40} strokeWidth={1} />
            <p style={{ fontSize: "14px", margin: 0 }}>Select an entry to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}
