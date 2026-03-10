import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Plus, Trash2, BookOpen, FileText, StickyNote, Cpu } from "lucide-react";
import { Modal, Select, Text, TextInput } from "@mantine/core";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { useProjectStore } from "@/stores/projectStore";
import {
  listKnowledge,
  createKnowledge,
  readKnowledgeContent,
  updateKnowledge,
  deleteKnowledge,
} from "@/lib/tauri";
import type { KnowledgeEntry, KnowledgeType } from "@/types";
import cn from "clsx";
import classes from "./KnowledgePanel.module.css";

const TYPE_ICONS: Record<KnowledgeType, ReactNode> = {
  system_prompt: <Cpu size={13} />,
  context_file: <FileText size={13} />,
  notes: <StickyNote size={13} />,
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  system_prompt: "System prompts",
  context_file: "Context files",
  notes: "Notes",
};

const TYPE_DESCRIPTIONS: Record<KnowledgeType, string> = {
  system_prompt: "Reusable instructions and framing",
  context_file: "Reference material for the workspace",
  notes: "Loose markdown documents and snippets",
};

const KNOWLEDGE_TYPES: KnowledgeType[] = [
  "system_prompt",
  "context_file",
  "notes",
];

interface NewEntryForm {
  name: string;
  type: KnowledgeType;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KnowledgePanel() {
  const { activeProjectId } = useProjectStore();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<NewEntryForm>({
    name: "",
    type: "notes",
  });
  const [creating, setCreating] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<KnowledgeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectionTokenRef = useRef<string | null>(null);
  const resetEditorState = () => {
    selectionTokenRef.current = null;
    setSelectedEntry(null);
    setEditorContent("");
    setLoadingContent(false);
    setLoadError(null);
  };

  const loadEntries = async () => {
    if (!activeProjectId) return;

    setLoading(true);
    try {
      const data = await listKnowledge(activeProjectId);
      data.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setEntries(data);
    } catch (err) {
      console.error("Failed to load knowledge:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetEditorState();
    setEntries([]);
    setPendingDeleteEntry(null);
    setShowNewForm(false);
    setNewForm({ name: "", type: "notes" });

    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    void loadEntries();
  }, [activeProjectId]);

  const handleSelectEntry = async (entry: KnowledgeEntry) => {
    if (!activeProjectId) return;

    const token = entry.id;
    selectionTokenRef.current = token;

    setSelectedEntry(entry);
    setLoadingContent(true);
    setLoadError(null);

    try {
      const content = await readKnowledgeContent(activeProjectId, entry.id);

      if (selectionTokenRef.current !== token) return;

      setLoadingContent(false);
      setEditorContent(content);
    } catch (err) {
      if (selectionTokenRef.current !== token) return;

      console.error("Failed to load knowledge entry content:", err);
      setLoadingContent(false);
      setLoadError("Failed to load knowledge entry.");
    }
  };

  const handleSave = async (content: string) => {
    if (!selectedEntry || !activeProjectId || loadError) return;
    if (selectedEntry.project_id !== activeProjectId) {
      console.error("Refused to save a knowledge entry outside the active project.");
      resetEditorState();
      return;
    }

    try {
      const nextUpdatedAt = new Date().toISOString();
      await updateKnowledge(activeProjectId, selectedEntry.id, content);
      setEditorContent(content);
      setEntries((prev) =>
        prev
          .map((entry) =>
            entry.id === selectedEntry.id
              ? { ...entry, updated_at: nextUpdatedAt }
              : entry,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          ),
      );
      setSelectedEntry((prev) =>
        prev ? { ...prev, updated_at: nextUpdatedAt } : prev,
      );
    } catch (err) {
      console.error("Failed to save knowledge entry:", err);
    }
  };

  const handleDelete = async () => {
    if (!activeProjectId || !pendingDeleteEntry) return;
    if (pendingDeleteEntry.project_id !== activeProjectId) {
      console.error("Refused to delete a knowledge entry outside the active project.");
      setPendingDeleteEntry(null);
      resetEditorState();
      return;
    }

    setDeleting(true);
    try {
      await deleteKnowledge(activeProjectId, pendingDeleteEntry.id);
      setEntries((prev) => prev.filter((entry) => entry.id !== pendingDeleteEntry.id));

      if (selectedEntry?.id === pendingDeleteEntry.id) {
        resetEditorState();
      }

      setPendingDeleteEntry(null);
    } catch (err) {
      console.error("Failed to delete knowledge entry:", err);
    } finally {
      setDeleting(false);
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
      setEntries((prev) => [entry, ...prev]);
      setShowNewForm(false);
      setNewForm({ name: "", type: "notes" });
      void handleSelectEntry(entry);
    } catch (err) {
      console.error("Failed to create knowledge entry:", err);
    } finally {
      setCreating(false);
    }
  };

  const groupedEntries = useMemo(
    () =>
      KNOWLEDGE_TYPES.reduce(
        (acc, type) => {
          acc[type] = entries.filter((entry) => entry.content_type === type);
          return acc;
        },
        {} as Record<KnowledgeType, KnowledgeEntry[]>,
      ),
    [entries],
  );

  if (!activeProjectId) {
    return (
      <div className={classes.emptyState}>
        <BookOpen size={34} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to open the knowledge workspace.</p>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <aside className={classes.sidebar} aria-label="Knowledge navigation">
        <div className={classes.sidebarHeader}>
          <div>
            <p className={classes.sidebarEyebrow}>Reference workspace</p>
            <div className={classes.sidebarTitleRow}>
              <BookOpen size={15} className={classes.sidebarTitleIcon} />
              <h2 className={classes.sidebarTitle}>Knowledge</h2>
              <span className={classes.countBadge}>{entries.length}</span>
            </div>
            <p className={classes.sidebarDescription}>
              Open prompts, context files, and notes in the same markdown editor shell.
            </p>
          </div>

          <button
            type="button"
            className={classes.iconButton}
            onClick={() => setShowNewForm(true)}
            aria-label="Create knowledge entry"
            title="Create knowledge entry"
          >
            <Plus size={15} />
          </button>
        </div>

        {showNewForm && (
          <form
            className={classes.newForm}
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <div className={classes.newFormHeader}>
              <span className={classes.newFormEyebrow}>New entry</span>
              <p className={classes.newFormText}>
                Choose a document type, then jump straight into the markdown workspace.
              </p>
            </div>
            <TextInput
              value={newForm.name}
              onChange={(e) =>
                setNewForm((form) => ({ ...form, name: e.target.value }))
              }
              placeholder="System primer, reference note, checklist…"
              autoFocus
              classNames={{ input: classes.fieldInput }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowNewForm(false);
                  setNewForm({ name: "", type: "notes" });
                }
              }}
            />
            <Select
              data={KNOWLEDGE_TYPES.map((type) => ({
                value: type,
                label: TYPE_LABELS[type],
              }))}
              value={newForm.type}
              onChange={(value) =>
                setNewForm((form) => ({
                  ...form,
                  type: (value ?? "notes") as KnowledgeType,
                }))
              }
              classNames={{
                input: classes.fieldInput,
                dropdown: classes.selectDropdown,
                option: classes.selectOption,
              }}
            />
            <div className={classes.formActions}>
              <button
                type="submit"
                className={classes.primaryButton}
                disabled={creating || !newForm.name.trim()}
              >
                {creating ? "Creating…" : "Create entry"}
              </button>
              <button
                type="button"
                className={classes.secondaryButton}
                onClick={() => {
                  setShowNewForm(false);
                  setNewForm({ name: "", type: "notes" });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={classes.list}>
          {loading ? (
            <div className={classes.listMessage}>Loading knowledge…</div>
          ) : entries.length === 0 ? (
            <div className={classes.listEmpty}>
              <BookOpen size={24} strokeWidth={1} className={classes.emptyIcon} />
              <p>No knowledge entries yet.</p>
              <span>Store reusable prompts, context, and research here.</span>
            </div>
          ) : (
            KNOWLEDGE_TYPES.map((type) => {
              const typeEntries = groupedEntries[type];
              if (typeEntries.length === 0) return null;

              return (
                <section key={type} className={classes.group} aria-label={TYPE_LABELS[type]}>
                  <div className={classes.groupHeader}>
                    <div className={classes.groupTitleRow}>
                      <span className={classes.groupIcon}>{TYPE_ICONS[type]}</span>
                      <div>
                        <h3 className={classes.groupTitle}>{TYPE_LABELS[type]}</h3>
                        <p className={classes.groupDescription}>{TYPE_DESCRIPTIONS[type]}</p>
                      </div>
                    </div>
                    <span className={classes.groupCount}>{typeEntries.length}</span>
                  </div>

                  <div className={classes.groupList} role="list">
                    {typeEntries.map((entry) => {
                      const isSelected = selectedEntry?.id === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={cn(classes.listItem, isSelected && classes.listItemActive)}
                        >
                          <div className={classes.cardAccent} aria-hidden="true" />
                          <div
                            className={classes.entryCard}
                            onClick={() => void handleSelectEntry(entry)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void handleSelectEntry(entry);
                              }
                            }}
                          >
                            <div className={classes.cardMetaRow}>
                              <span className={classes.cardChip}>{TYPE_LABELS[type]}</span>
                              <span className={classes.cardDate}>{formatRelativeDate(entry.updated_at)}</span>
                            </div>
                            <span className={classes.cardTitle}>{entry.name}</span>
                            <span className={classes.cardDescription}>
                              Last updated {formatAbsoluteDate(entry.updated_at)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteEntry(entry);
                            }}
                            aria-label={`Delete ${entry.name}`}
                            className={classes.deleteButton}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </aside>

      <main className={classes.editorArea}>
        {selectedEntry && loadingContent ? (
          <div className={classes.emptyState}>
            <p>Loading entry…</p>
          </div>
        ) : selectedEntry && loadError ? (
          <div className={classes.emptyState}>
            <p>{loadError}</p>
            <span>We kept the saved file untouched. Retry to reopen the entry.</span>
            <button
              type="button"
              className={classes.primaryButton}
              onClick={() => void handleSelectEntry(selectedEntry)}
            >
              Retry
            </button>
          </div>
        ) : selectedEntry ? (
          <KnowledgeEditor
            key={selectedEntry.id}
            entry={selectedEntry}
            content={editorContent}
            onSave={handleSave}
            onCancel={resetEditorState}
          />
        ) : (
          <div className={classes.emptyState}>
            <BookOpen size={42} strokeWidth={1} className={classes.emptyIcon} />
            <p>Select an entry to open the markdown workspace.</p>
          </div>
        )}
      </main>

      <Modal
        opened={!!pendingDeleteEntry}
        onClose={() => !deleting && setPendingDeleteEntry(null)}
        title="Delete knowledge entry"
        centered
        size="sm"
        overlayProps={{ blur: 3, backgroundOpacity: 0.6 }}
        styles={{
          header: {
            backgroundColor: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
          },
          title: {
            color: "var(--text-primary)",
            fontSize: "14px",
            fontWeight: 600,
          },
          body: {
            padding: 20,
            backgroundColor: "var(--bg-elevated)",
          },
          content: {
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          },
          close: {
            color: "var(--text-secondary)",
          },
        }}
      >
        <Text size="sm" c="var(--text-secondary)" mb="md">
          Delete "{pendingDeleteEntry?.name}"? This cannot be undone.
        </Text>
        <div className={classes.modalActions}>
          <button
            type="button"
            className={classes.secondaryButton}
            onClick={() => setPendingDeleteEntry(null)}
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
      </Modal>
    </div>
  );
}
