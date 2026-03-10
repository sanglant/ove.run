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
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES } from "@/constants/styles";
import { SectionTitle } from "@/components/ui/SectionTitle";
import classes from "./NewProjectDialog.module.css";

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

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="Add Project"
      centered
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      styles={{
        ...MODAL_STYLES,
        content: { ...MODAL_STYLES.content, width: "400px" },
      }}
    >
      {/* Body */}
      <Stack gap="md" className={classes.content}>
        <TextInput
          id="project-name"
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Project"
          autoFocus
          styles={INPUT_STYLES}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />

        <div>
          <SectionTitle mb={6}>Directory Path</SectionTitle>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              id="project-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/my-project"
              className={classes.flex1}
              styles={{
                input: {
                  ...INPUT_STYLES.input,
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
          <Text size="xs" c="var(--danger)">
            {error}
          </Text>
        )}
      </Stack>

      {/* Footer */}
      <div className={classes.footer}>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" onClick={onClose} styles={BUTTON_STYLES.subtle}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading || !name.trim() || !path.trim()} styles={BUTTON_STYLES.primary}>
            {loading ? "Adding..." : "Add Project"}
          </Button>
        </Group>
      </div>
    </Modal>
  );
}
