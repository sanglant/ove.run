import { useState } from "react";
import { GitCommit } from "lucide-react";

interface CommitFormProps {
  stagedCount: number;
  onCommit: (message: string) => Promise<boolean>;
}

export function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCommit = stagedCount > 0 && message.trim().length > 0 && !loading;

  const handleCommit = async () => {
    if (!canCommit) return;
    setLoading(true);
    setError(null);
    try {
      const success = await onCommit(message.trim());
      if (success) {
        setMessage("");
      } else {
        setError("Commit failed. Check the console for details.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">
          {stagedCount > 0 ? (
            <span className="text-[var(--success)]">{stagedCount} staged</span>
          ) : (
            <span>No staged changes</span>
          )}
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
        rows={3}
        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors font-mono"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            handleCommit();
          }
        }}
        aria-label="Commit message"
      />

      {error && (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      )}

      <button
        onClick={handleCommit}
        disabled={!canCommit}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Commit staged changes"
      >
        <GitCommit size={14} />
        {loading ? "Committing..." : "Commit"}
      </button>

      <p className="text-[10px] text-[var(--text-secondary)] text-center">
        Ctrl+Enter to commit
      </p>
    </div>
  );
}
