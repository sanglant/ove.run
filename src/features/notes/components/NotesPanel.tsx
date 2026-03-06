import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, FileText, StickyNote } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import {
  listNotes,
  createNote,
  readNoteContent,
  updateNote,
  deleteNote,
} from "@/lib/tauri";
import type { ProjectNote } from "@/types";
import { Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { MarkdownEditorWorkspace } from "@/components/shared/MarkdownEditorWorkspace";
import classes from "./NotesPanel.module.css";

const inputStyles = {
  input: {
    backgroundColor: "var(--bg-secondary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    fontSize: "12px",
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotesPanel() {
  const { activeProjectId } = useProjectStore();

  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ProjectNote | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  // Editor state — owned here so workspace can be fully controlled
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<ProjectNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tracks the most-recently-requested note id so stale async responses are
  // silently discarded. A ref (not state) because updating it must never
  // trigger a re-render of its own.
  const selectionTokenRef = useRef<string | null>(null);

  // New note form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!activeProjectId) return;
    setLoadingList(true);
    try {
      const data = await listNotes(activeProjectId);
      // Sort by updated_at descending
      data.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoadingList(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setNotes([]);
      setSelectedNote(null);
      setEditorContent("");
      setSavedContent("");
      return;
    }
    loadNotes();
  }, [activeProjectId, loadNotes]);

  const handleSelectNote = async (note: ProjectNote) => {
    // Stamp this invocation so any earlier in-flight load can detect it is stale.
    const token = note.id;
    selectionTokenRef.current = token;

    setSelectedNote(note);
    setEditorTitle(note.title);
    setSavedTitle(note.title);
    setEditorContent("");
    setSavedContent("");
    setLoadingContent(true);

    let content = "";
    let failed = false;
    try {
      content = await readNoteContent(activeProjectId ?? "", note.id);
    } catch {
      failed = true;
    }

    // If another note was selected while we were awaiting, throw away this
    // result entirely — do NOT touch any state that belongs to the new selection.
    if (selectionTokenRef.current !== token) return;

    setLoadingContent(false);
    setEditorContent(failed ? "" : content);
    setSavedContent(failed ? "" : content);
  };

  const dirty =
    editorContent !== savedContent || editorTitle !== savedTitle;

  const handleSave = async () => {
    if (!selectedNote || !activeProjectId) return;
    setSaving(true);
    try {
      await updateNote(
        activeProjectId,
        selectedNote.id,
        editorTitle.trim() || selectedNote.title,
        editorContent,
      );
      setSavedContent(editorContent);
      const finalTitle = editorTitle.trim() || selectedNote.title;
      setSavedTitle(finalTitle);
      // Refresh list & bubble updated_at
      setNotes((prev) =>
        prev
          .map((n) =>
            n.id === selectedNote.id
              ? {
                  ...n,
                  title: finalTitle,
                  updated_at: new Date().toISOString(),
                }
              : n,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          ),
      );
      setSelectedNote((prev) =>
        prev ? { ...prev, title: finalTitle } : prev,
      );
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!activeProjectId || !newTitle.trim()) return;
    setCreating(true);
    try {
      const note = await createNote(activeProjectId, newTitle.trim(), "");
      setNotes((prev) => [note, ...prev]);
      setShowNewForm(false);
      setNewTitle("");
      handleSelectNote(note);
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProjectId || !pendingDeleteNote) return;
    setDeleting(true);
    try {
      await deleteNote(activeProjectId, pendingDeleteNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== pendingDeleteNote.id));
      if (selectedNote?.id === pendingDeleteNote.id) {
        setSelectedNote(null);
        setEditorContent("");
        setSavedContent("");
        setEditorTitle("");
        setSavedTitle("");
      }
      setPendingDeleteNote(null);
    } catch (err) {
      console.error("Failed to delete note:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setSelectedNote(null);
    setEditorContent("");
    setSavedContent("");
    setEditorTitle("");
    setSavedTitle("");
  };

  if (!activeProjectId) {
    return (
      <div className={classes.empty}>
        <StickyNote size={32} strokeWidth={1} style={{ opacity: 0.35 }} />
        <p>Select a project to view notes</p>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      {/* ── Left: notes list ── */}
      <aside className={classes.sidebar} aria-label="Notes list">
        {/* Header */}
        <div className={classes.sidebarHeader}>
          <Group gap={8} wrap="nowrap">
            <FileText size={14} color="var(--accent)" />
            <span className={classes.sidebarTitle}>Notes</span>
          </Group>
          <button
            onClick={() => setShowNewForm(true)}
            aria-label="New note"
            className={classes.iconBtn}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* New note form */}
        {showNewForm && (
          <div className={classes.newForm}>
            <TextInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Note title…"
              autoFocus
              styles={inputStyles}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowNewForm(false);
                  setNewTitle("");
                }
              }}
            />
            <Group gap={6} grow>
              <Button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                size="xs"
                styles={{
                  root: {
                    backgroundColor: "var(--accent)",
                    color: "var(--bg-primary)",
                    "&:hover:not(:disabled)": {
                      backgroundColor: "var(--accent-hover)",
                    },
                    "&:disabled": { opacity: 0.4 },
                  },
                }}
              >
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button
                variant="default"
                size="xs"
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                }}
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

        {/* Notes list */}
        <div className={classes.list} role="list">
          {loadingList ? (
            <div className={classes.listEmpty}>Loading…</div>
          ) : notes.length === 0 ? (
            <div className={classes.listEmpty}>
              <StickyNote
                size={22}
                style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }}
              />
              No notes yet
            </div>
          ) : (
            notes.map((note) => {
              const isSelected = selectedNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  className={`${classes.noteRow} ${isSelected ? classes.noteRowActive : ""}`}
                  onClick={() => handleSelectNote(note)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSelectNote(note);
                  }}
                >
                  <div className={classes.noteRowInner}>
                    <span className={classes.noteTitle}>{note.title}</span>
                    <span className={classes.noteDate}>
                      {formatDate(note.updated_at)}
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
                      setPendingDeleteNote(note);
                    }}
                    aria-label={`Delete ${note.title}`}
                    className={classes.deleteBtn}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right: editor ── */}
      <main className={classes.editorArea}>
        {selectedNote && !loadingContent ? (
          <MarkdownEditorWorkspace
            key={selectedNote.id}
            content={editorContent}
            onContentChange={setEditorContent}
            title={editorTitle}
            onTitleChange={setEditorTitle}
            titleEditable
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
            placeholder="Start writing your note…"
          />
        ) : selectedNote && loadingContent ? (
          <div className={classes.empty}>
            <p>Loading…</p>
          </div>
        ) : (
          <div className={classes.empty}>
            <StickyNote size={40} strokeWidth={1} style={{ opacity: 0.25 }} />
            <p>Select a note or create a new one</p>
          </div>
        )}
      </main>

      <Modal
        opened={!!pendingDeleteNote}
        onClose={() => !deleting && setPendingDeleteNote(null)}
        title="Delete note"
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
          Delete "{pendingDeleteNote?.title}"? This cannot be undone.
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button
            variant="default"
            onClick={() => setPendingDeleteNote(null)}
            disabled={deleting}
            styles={{
              root: {
                backgroundColor: "transparent",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                "&:hover:not(:disabled)": {
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                },
              },
            }}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleting}
            styles={{
              root: {
                backgroundColor: "var(--danger)",
                color: "#fff",
                "&:hover:not(:disabled)": {
                  opacity: 0.9,
                },
              },
            }}
          >
            Delete note
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
