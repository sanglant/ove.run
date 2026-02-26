import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/projectStore";
import {
  Modal,
  TextInput,
  Button,
  Group,
  Text,
  Stack,
} from "@mantine/core";

interface NewProjectDialogProps {
  onClose: () => void;
}

const inputStyles = {
  input: {
    backgroundColor: "var(--bg-tertiary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    "& ::placeholder": { color: "var(--text-secondary)" },
    "&:focus": { borderColor: "var(--accent)" },
  },
  label: {
    color: "var(--text-secondary)",
    fontSize: "10px",
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
};

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

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="Add Project"
      centered
      overlayProps={{ blur: 3, backgroundOpacity: 0.6 }}
      transitionProps={{ transition: "slide-up" }}
      styles={{
        header: {
          backgroundColor: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 20px",
        },
        title: {
          color: "var(--text-primary)",
          fontSize: "14px",
          fontWeight: 600,
        },
        body: {
          padding: 0,
          backgroundColor: "var(--bg-elevated)",
        },
        content: {
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-bright)",
          width: "400px",
        },
        close: {
          color: "var(--text-secondary)",
        },
      }}
    >
      {/* Body */}
      <Stack gap="md" style={{ padding: "20px" }}>
        <TextInput
          id="project-name"
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Project"
          autoFocus
          styles={inputStyles}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />

        <div>
          <Text
            size="xs"
            style={{
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 500,
              marginBottom: "6px",
            }}
          >
            Directory Path
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              id="project-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/my-project"
              style={{ flex: 1 }}
              styles={{
                input: {
                  ...inputStyles.input,
                  fontFamily: "monospace",
                },
              }}
            />
            <Button
              variant="default"
              leftSection={<FolderOpen size={14} />}
              onClick={handleBrowse}
              aria-label="Browse for directory"
              styles={{
                root: {
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  "&:hover": {
                    borderColor: "var(--accent)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--bg-tertiary)",
                  },
                },
              }}
            >
              Browse
            </Button>
          </Group>
        </div>

        {error && (
          <Text size="xs" style={{ color: "var(--danger)" }}>
            {error}
          </Text>
        )}
      </Stack>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 20px",
        }}
      >
        <Group justify="flex-end" gap="xs">
          <Button
            variant="subtle"
            onClick={onClose}
            styles={{
              root: {
                color: "var(--text-secondary)",
                "&:hover": {
                  color: "var(--text-primary)",
                  backgroundColor: "transparent",
                },
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={loading || !name.trim() || !path.trim()}
            styles={{
              root: {
                backgroundColor: "var(--accent)",
                color: "var(--bg-primary)",
                "&:hover": { backgroundColor: "var(--accent-hover)" },
                "&:disabled": { opacity: 0.5 },
              },
            }}
          >
            {loading ? "Adding..." : "Add Project"}
          </Button>
        </Group>
      </div>
    </Modal>
  );
}
