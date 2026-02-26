import { useState } from "react";
import { X, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/projectStore";

interface NewProjectDialogProps {
  onClose: () => void;
}

export function NewProjectDialog({ onClose }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addProject } = useProjectStore();

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });
      if (typeof selected === "string") {
        setPath(selected);
        // Auto-fill name from folder name if empty
        if (!name.trim()) {
          const parts = selected.split("/");
          setName(parts[parts.length - 1] ?? "");
        }
      }
    } catch (err) {
      console.error("Failed to open directory picker:", err);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !path.trim()) {
      setError("Name and path are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addProject(name.trim(), path.trim());
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
    >
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg w-[400px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2
            id="new-project-title"
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            Add Project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider"
            >
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              autoFocus
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>

          {/* Path */}
          <div>
            <label
              htmlFor="project-path"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider"
            >
              Directory Path
            </label>
            <div className="flex gap-2">
              <input
                id="project-path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/home/user/my-project"
                className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
              />
              <button
                onClick={handleBrowse}
                aria-label="Browse for directory"
                className="flex items-center gap-1.5 px-3 py-2 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors text-xs"
              >
                <FolderOpen size={14} />
                Browse
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[var(--danger)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || !name.trim() || !path.trim()}
            className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Adding..." : "Add Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
