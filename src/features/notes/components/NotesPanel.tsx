import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, FileText, StickyNote } from "lucide-react";
import { Modal, TextInput, Text } from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
import { MarkdownEditorWorkspace } from "@/components/shared/MarkdownEditorWorkspace";
import { useProjectStore } from "@/stores/projectStore";
import {
  listNotes,
  createNote,
  readNoteContent,
  updateNote,
  deleteNote,
} from "@/lib/tauri";
import type { Note } from "@/types";
import cn from "clsx";
import classes from "./NotesPanel.module.css";

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

export function NotesPanel() {
  const { activeProjectId } = useProjectStore();

  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectionTokenRef = useRef<string | null>(null);
  const resetEditorState = useCallback(() => {
    selectionTokenRef.current = null;
    setSelectedNote(null);
    setEditorContent("");
    setSavedContent("");
    setEditorTitle("");
    setSavedTitle("");
    setLoadingContent(false);
    setLoadError(null);
  }, []);

  const loadNotes = useCallback(async () => {
    if (!activeProjectId) return;

    setLoadingList(true);
    try {
      const data = await listNotes(activeProjectId);
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
    resetEditorState();
    setNotes([]);
    setPendingDeleteNote(null);
    setShowNewForm(false);
    setNewTitle("");

    if (!activeProjectId) {
      setLoadingList(false);
      return;
    }

    void loadNotes();
  }, [activeProjectId, loadNotes, resetEditorState]);

  const handleSelectNote = async (note: Note) => {
    if (!activeProjectId) return;

    const token = note.id;
    selectionTokenRef.current = token;

    setSelectedNote(note);
    setEditorTitle(note.title);
    setSavedTitle(note.title);
    setLoadingContent(true);
    setLoadError(null);

    try {
      const content = await readNoteContent(activeProjectId, note.id);

      if (selectionTokenRef.current !== token) return;

      setEditorContent(content);
      setSavedContent(content);
      setLoadingContent(false);
    } catch (err) {
      if (selectionTokenRef.current !== token) return;

      console.error("Failed to load note content:", err);
      setLoadingContent(false);
      setLoadError("Failed to load note content.");
    }
  };

  const dirty =
    loadError === null &&
    (editorContent !== savedContent || editorTitle !== savedTitle);

  const handleSave = async () => {
    if (!selectedNote || !activeProjectId || loadError) return;
    if (selectedNote.project_id !== activeProjectId) {
      console.error("Refused to save a note outside the active project.");
      resetEditorState();
      return;
    }

    setSaving(true);
    try {
      const finalTitle = editorTitle.trim() || selectedNote.title;
      const nextUpdatedAt = new Date().toISOString();

      await updateNote(
        activeProjectId,
        selectedNote.id,
        finalTitle,
        editorContent,
      );

      setSavedContent(editorContent);
      setSavedTitle(finalTitle);
      setNotes((prev) =>
        prev
          .map((note) =>
            note.id === selectedNote.id
              ? { ...note, title: finalTitle, updated_at: nextUpdatedAt }
              : note,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          ),
      );
      setSelectedNote((prev) =>
        prev
          ? { ...prev, title: finalTitle, updated_at: nextUpdatedAt }
          : prev,
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
      void handleSelectNote(note);
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProjectId || !pendingDeleteNote) return;
    if (pendingDeleteNote.project_id !== activeProjectId) {
      console.error("Refused to delete a note outside the active project.");
      setPendingDeleteNote(null);
      resetEditorState();
      return;
    }

    setDeleting(true);
    try {
      await deleteNote(activeProjectId, pendingDeleteNote.id);
      setNotes((prev) => prev.filter((note) => note.id !== pendingDeleteNote.id));

      if (selectedNote?.id === pendingDeleteNote.id) {
        resetEditorState();
      }

      setPendingDeleteNote(null);
    } catch (err) {
      console.error("Failed to delete note:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    resetEditorState();
  };

  if (!activeProjectId) {
    return (
      <div className={classes.emptyState}>
        <StickyNote size={34} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to open your notes workspace.</p>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <aside className={classes.sidebar} aria-label="Notes navigation" data-tour="notes-list">
        <div className={classes.sidebarHeader}>
          <div>
            <p className={classes.sidebarEyebrow}>Markdown workspace</p>
            <div className={classes.sidebarTitleRow}>
              <FileText size={15} className={classes.sidebarTitleIcon} />
              <h2 className={classes.sidebarTitle}>Notes</h2>
              <span className={classes.countBadge}>{notes.length}</span>
            </div>
            <p className={classes.sidebarDescription}>
              Browse documents, then open one into the full writing view.
            </p>
          </div>

          <button
            type="button"
            className={classes.iconButton}
            onClick={() => setShowNewForm(true)}
            aria-label="Create note"
            title="Create note"
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
              <span className={classes.newFormEyebrow}>New note</span>
              <p className={classes.newFormText}>Start with a title. The body opens immediately.</p>
            </div>
            <TextInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Project brief, meeting log, draft…"
              autoFocus
              classNames={{ input: classes.fieldInput }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowNewForm(false);
                  setNewTitle("");
                }
              }}
            />
            <div className={classes.formActions}>
              <button
                type="submit"
                className={classes.primaryButton}
                disabled={creating || !newTitle.trim()}
              >
                {creating ? "Creating…" : "Create note"}
              </button>
              <button
                type="button"
                className={classes.secondaryButton}
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={classes.list} role="list">
          {loadingList ? (
            <div className={classes.listMessage}>Loading notes…</div>
          ) : notes.length === 0 ? (
            <div className={classes.listEmpty}>
              <StickyNote size={24} strokeWidth={1} className={classes.emptyListIcon} />
              <p>No notes yet.</p>
              <span>Create the first document to start your workspace.</span>
            </div>
          ) : (
            notes.map((note) => {
              const isSelected = selectedNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  className={cn(classes.listItem, isSelected && classes.listItemActive)}
                >
                  <div className={classes.cardAccent} aria-hidden="true" />
                  <div
                    className={classes.noteCard}
                    onClick={() => void handleSelectNote(note)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleSelectNote(note);
                      }
                    }}
                  >
                    <div className={classes.cardMetaRow}>
                      <span className={classes.cardChip}>Markdown note</span>
                      <span className={classes.cardDate}>{formatRelativeDate(note.updated_at)}</span>
                    </div>
                    <span className={classes.cardTitle}>{note.title}</span>
                    <span className={classes.cardDescription}>
                      Last touched {formatAbsoluteDate(note.updated_at)}
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
                    className={classes.deleteButton}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className={classes.editorArea} data-tour="notes-editor">
        {selectedNote && loadingContent ? (
          <div className={classes.emptyState}>
            <p>Loading note…</p>
          </div>
        ) : selectedNote && loadError ? (
          <div className={classes.emptyState}>
            <p>{loadError}</p>
            <span>We kept the saved file untouched. Retry to reopen the note.</span>
            <button
              type="button"
              className={classes.primaryButton}
              onClick={() => void handleSelectNote(selectedNote)}
            >
              Retry
            </button>
          </div>
        ) : selectedNote ? (
          <MarkdownEditorWorkspace
            key={selectedNote.id}
            content={editorContent}
            onContentChange={setEditorContent}
            title={editorTitle}
            onTitleChange={setEditorTitle}
            titleEditable
            eyebrow="Project note"
            subtitle="Markdown-first drafting space"
            updatedAt={selectedNote.updated_at}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
            placeholder="Start writing your note…"
          />
        ) : (
          <div className={classes.emptyState}>
            <StickyNote size={42} strokeWidth={1} className={classes.emptyIcon} />
            <p>Select a note to enter the editor workspace.</p>
          </div>
        )}
      </main>

      <Modal
        opened={!!pendingDeleteNote}
        onClose={() => !deleting && setPendingDeleteNote(null)}
        title="Delete note"
        centered
        size="sm"
        overlayProps={MODAL_OVERLAY_PROPS}
        styles={{
          ...MODAL_STYLES,
          body: { ...MODAL_STYLES.body, padding: 20 },
        }}
      >
        <Text size="sm" c="var(--text-secondary)" mb="md">
          Delete "{pendingDeleteNote?.title}"? This cannot be undone.
        </Text>
        <div className={classes.modalActions}>
          <button
            type="button"
            className={classes.secondaryButton}
            onClick={() => setPendingDeleteNote(null)}
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
            {deleting ? "Deleting…" : "Delete note"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
