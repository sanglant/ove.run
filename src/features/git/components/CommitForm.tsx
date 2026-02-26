import { useState } from "react";
import { GitCommit } from "lucide-react";
import { Button, Text, Textarea } from "@mantine/core";

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
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {stagedCount > 0 ? (
          <Text size="xs" c="var(--success)">
            {stagedCount} staged
          </Text>
        ) : (
          <Text size="xs" c="var(--text-secondary)">
            No staged changes
          </Text>
        )}
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
        rows={3}
        aria-label="Commit message"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            handleCommit();
          }
        }}
        styles={{
          input: {
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            fontFamily: "monospace",
            fontSize: "13px",
            resize: "none",
            "&::placeholder": { color: "var(--text-secondary)" },
            "&:focus": { borderColor: "var(--accent)" },
          },
        }}
      />

      {error && (
        <Text size="xs" c="var(--danger)">
          {error}
        </Text>
      )}

      <Button
        onClick={handleCommit}
        disabled={!canCommit}
        leftSection={<GitCommit size={14} />}
        fullWidth
        aria-label="Commit staged changes"
        styles={{
          root: {
            backgroundColor: "var(--accent)",
            color: "var(--bg-primary)",
            "&:hover:not(:disabled)": { backgroundColor: "var(--accent-hover)" },
            "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
          },
        }}
      >
        {loading ? "Committing..." : "Commit"}
      </Button>

      <Text size="xs" c="var(--text-secondary)" style={{ textAlign: "center", fontSize: "10px" }}>
        Ctrl+Enter to commit
      </Text>
    </div>
  );
}
