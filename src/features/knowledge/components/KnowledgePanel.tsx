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
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
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
    <div className="flex h-full overflow-hidden">
      {/* Left: Entry list */}
      <div className="flex flex-col w-60 shrink-0 border-r border-[var(--border)]">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Knowledge
            </span>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            aria-label="New knowledge entry"
            className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* New entry form */}
        {showNewForm && (
          <div className="p-3 border-b border-[var(--border)] space-y-2 bg-[var(--bg-tertiary)]">
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Entry name..."
              autoFocus
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowNewForm(false);
              }}
            />
            <select
              value={newForm.type}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, type: e.target.value as KnowledgeType }))
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {KNOWLEDGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <button
                onClick={handleCreate}
                disabled={creating || !newForm.name.trim()}
                className="flex-1 py-1 text-xs rounded bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex-1 py-1 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Grouped entries */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-8 text-center text-xs text-[var(--text-secondary)]">
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-[var(--text-secondary)]">
              <BookOpen size={24} className="mx-auto mb-2 opacity-40" />
              No knowledge entries
            </div>
          ) : (
            KNOWLEDGE_TYPES.map((type) => {
              const typeEntries = grouped[type];
              if (typeEntries.length === 0) return null;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {TYPE_ICONS[type]}
                    {TYPE_LABELS[type]}
                  </div>
                  {typeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={[
                        "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                        selectedEntry?.id === entry.id
                          ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                      onClick={() => handleSelectEntry(entry)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSelectEntry(entry);
                      }}
                    >
                      <span className="flex-1 text-xs truncate">{entry.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry);
                        }}
                        aria-label={`Delete ${entry.name}`}
                        className="opacity-0 group-hover:opacity-100 text-[var(--danger)] transition-opacity"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 overflow-hidden">
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
            <BookOpen size={40} strokeWidth={1} />
            <p className="text-sm">Select an entry to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}
