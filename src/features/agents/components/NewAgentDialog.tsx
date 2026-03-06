import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { listAgentTypes } from "@/lib/tauri";
import type { AgentType, AgentDefinition, AgentSession } from "@/types";
import {
  Modal,
  TextInput,
  Button,
  Group,
  Switch,
  Alert,
  SimpleGrid,
  Paper,
  Text,
  Stack,
} from "@mantine/core";

interface NewAgentDialogProps {
  projectId: string;
  onClose: () => void;
}

const inputStyles = {
  input: {
    backgroundColor: "var(--bg-tertiary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
    "&::placeholder": { color: "var(--text-secondary)" },
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

export function NewAgentDialog({ projectId, onClose }: NewAgentDialogProps) {
  const [agentType, setAgentType] = useState<AgentType>("claude");
  const [yoloMode, setYoloMode] = useState(false);
  const [label, setLabel] = useState("");
  const [agentDefs, setAgentDefs] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const { addSession } = useSessionStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    listAgentTypes()
      .then(setAgentDefs)
      .catch(() => {
        // Use fallback definitions
        setAgentDefs([
          {
            agent_type: "claude",
            display_name: "Claude Code",
            command: "claude",
            default_args: [],
            yolo_flag: "--dangerously-skip-permissions",
            resume_args: [],
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "C",
          },
          {
            agent_type: "gemini",
            display_name: "Gemini CLI",
            command: "gemini",
            default_args: [],
            yolo_flag: "--yolo",
            resume_args: [],
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "G",
          },
          {
            agent_type: "copilot",
            display_name: "GitHub Copilot",
            command: "copilot",
            default_args: [],
            yolo_flag: "--yolo",
            resume_args: [],
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "P",
          },
          {
            agent_type: "codex",
            display_name: "Codex CLI",
            command: "codex",
            default_args: [],
            yolo_flag: "--full-auto",
            resume_args: [],
            detect_idle_pattern: "",
            detect_input_pattern: "",
            detect_finished_pattern: "",
            icon: "X",
          },
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const agentSettings = settings.agents[agentType];
    if (agentSettings) {
      setYoloMode(agentSettings.default_yolo_mode);
    }
  }, [agentType, settings.agents]);

  const handleStart = () => {
    if (!projectId) return;
    setLoading(true);

    const agentDef = agentDefs.find((d) => d.agent_type === agentType);
    const sessionLabel =
      label.trim() ||
      `${agentDef?.display_name ?? agentType} #${Date.now().toString(36).slice(-4)}`;

    const session: AgentSession = {
      id: uuidv4(),
      projectId,
      agentType,
      status: "starting",
      yoloMode,
      createdAt: new Date().toISOString(),
      label: sessionLabel,
      isGuardian: false,
      isResumed: false,
    };

    addSession(session);
    setLoading(false);
    onClose();
  };

  const AGENT_META: Record<string, { label: string; color: string }> = {
    claude: { label: "C", color: "var(--claude)" },
    gemini: { label: "G", color: "var(--gemini)" },
    copilot: { label: "P", color: "var(--copilot)" },
    codex: { label: "X", color: "var(--codex)" },
    terminal: { label: ">_", color: "var(--text-secondary)" },
  };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="New Agent Session"
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
          width: "420px",
        },
        close: {
          color: "var(--text-secondary)",
        },
      }}
    >
      {/* Body */}
      <Stack gap="lg" style={{ padding: "20px" }}>
        {/* Agent type selector */}
        <div>
          <Text
            size="xs"
            style={{
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 500,
              marginBottom: "8px",
            }}
          >
            Agent Type
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            {agentDefs.map((def) => {
              const meta = AGENT_META[def.agent_type] ?? { label: "?", color: "var(--text-secondary)" };
              const isSelected = agentType === def.agent_type;
              return (
                <Paper
                  key={def.agent_type}
                  withBorder
                  p="sm"
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected
                      ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                      : "var(--bg-tertiary)",
                    borderColor: isSelected ? meta.color : "var(--border)",
                    transition: "border-color 0.15s, background-color 0.15s",
                  }}
                  onClick={() => setAgentType(def.agent_type as AgentType)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Text
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: meta.color,
                        lineHeight: 1,
                      }}
                    >
                      {meta.label}
                    </Text>
                    <div>
                      <Text
                        size="sm"
                        fw={500}
                        style={{
                          color: isSelected
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {def.display_name}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </div>

        {/* Label input */}
        <TextInput
          id="session-label"
          label={
            <>
              Label{" "}
              <Text
                component="span"
                size="xs"
                style={{ color: "var(--text-secondary)", fontWeight: 400 }}
              >
                (optional)
              </Text>
            </>
          }
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Feature branch, Bug fix..."
          styles={inputStyles}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleStart();
          }}
        />

        {/* YOLO mode toggle — hidden for plain terminal */}
        {agentType !== "terminal" && (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text
              size="xs"
              style={{
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
              }}
            >
              YOLO Mode
            </Text>
            <Switch
              checked={yoloMode}
              onChange={(e) => setYoloMode(e.currentTarget.checked)}
              color="red"
              styles={{
                track: {
                  backgroundColor: yoloMode ? undefined : "var(--bg-tertiary)",
                  borderColor: "var(--bg-tertiary)",
                },
              }}
            />
          </Group>
          {yoloMode && (
            <Alert
              icon={<AlertTriangle size={14} />}
              color="red"
              styles={{
                root: {
                  backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                  padding: "10px",
                },
                icon: { color: "var(--danger)" },
                message: { color: "var(--danger)", fontSize: "12px" },
              }}
            >
              YOLO mode bypasses all confirmation prompts. The agent will
              execute commands without asking for permission.
            </Alert>
          )}
        </Stack>
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
            onClick={handleStart}
            disabled={loading || !projectId}
            styles={{
              root: {
                backgroundColor: "var(--accent)",
                color: "var(--bg-primary)",
                "&:hover": { backgroundColor: "var(--accent-hover)" },
                "&:disabled": { opacity: 0.5 },
              },
            }}
          >
            {loading ? "Starting..." : "Start Session"}
          </Button>
        </Group>
      </div>
    </Modal>
  );
}
