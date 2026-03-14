import { useState, useEffect } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { listAgentTypes, setMaxIterations as setMaxIterationsFn, startLoop } from "@/lib/tauri";
import type { AgentType, AgentDefinition, AgentSession } from "@/types";
import {
  Modal,
  TextInput,
  Textarea,
  Slider,
  NumberInput,
  Button,
  Group,
  Switch,
  Alert,
  SimpleGrid,
  Paper,
  Text,
  Stack,
} from "@mantine/core";
import { getAgentMeta } from "@/constants/agents";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES } from "@/constants/styles";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ModalFooter } from "@/components/ui/ModalFooter";
import classes from "./NewAgentDialog.module.css";

interface NewAgentDialogProps {
  projectId: string;
  onClose: () => void;
  initialLabel?: string;
  initialPrompt?: string;
}

export function NewAgentDialog({ projectId, onClose, initialLabel, initialPrompt }: NewAgentDialogProps) {
  const [agentType, setAgentType] = useState<AgentType>("claude");
  const [yoloMode, setYoloMode] = useState(false);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [agentDefs, setAgentDefs] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [sandboxed, setSandboxed] = useState(false);
  const [arbiterEnabled, setArbiterEnabled] = useState(false);
  const [maxIterations, setMaxIterations] = useState(10);
  const [initialPromptText, setInitialPromptText] = useState(initialPrompt ?? "");

  const { addSession } = useSessionStore();
  const { settings, sandboxAvailable } = useSettingsStore();
  const setActivePanel = useUiStore((s) => s.setActivePanel);

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

  const handleStart = async () => {
    if (!projectId) return;
    if (arbiterEnabled && !initialPromptText.trim()) return;
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
      isResumed: false,
      sandboxed,
      arbiterEnabled,
      maxIterations: arbiterEnabled ? maxIterations : undefined,
      ...(initialPromptText.trim() ? { initialPrompt: initialPromptText.trim() } : {}),
    };

    addSession(session);
    setActivePanel("terminal");

    if (arbiterEnabled) {
      try {
        const projects = useProjectStore.getState().projects;
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          await setMaxIterationsFn(projectId, maxIterations);
          await startLoop(projectId, project.path, initialPromptText.trim());
        }
      } catch (err) {
        console.error("Failed to start arbiter loop:", err);
      }
    }

    setLoading(false);
    onClose();
  };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="New Agent Session"
      centered
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      styles={{
        ...MODAL_STYLES,
        content: { ...MODAL_STYLES.content, width: "420px" },
      }}
    >
      {/* Body */}
      <Stack gap="lg" className={classes.content}>
        {/* Agent type selector */}
        <div>
          <SectionTitle>Agent Type</SectionTitle>
          <SimpleGrid cols={2} spacing="xs">
            {agentDefs.map((def) => {
              const meta = getAgentMeta(def.agent_type);
              const isSelected = agentType === def.agent_type;
              return (
                <Paper
                  key={def.agent_type}
                  withBorder
                  p="sm"
                  className={classes.agentCard}
                  styles={{
                    root: {
                      backgroundColor: isSelected
                        ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                        : "var(--bg-tertiary)",
                      borderColor: isSelected ? meta.color : "var(--border)",
                    },
                  }}
                  onClick={() => setAgentType(def.agent_type as AgentType)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Text className={classes.agentIconLabel} c={meta.color}>
                      {meta.label}
                    </Text>
                    <div>
                      <Text
                        size="sm"
                        fw={500}
                        c={isSelected ? "var(--text-primary)" : "var(--text-secondary)"}
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
                c="var(--text-secondary)"
                fw={400}
              >
                (optional)
              </Text>
            </>
          }
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Feature branch, Bug fix..."
          styles={INPUT_STYLES}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleStart();
          }}
        />

        {/* Initial prompt textarea */}
        <Textarea
          label={
            <>
              Initial prompt{" "}
              <Text component="span" size="xs" c="var(--text-secondary)" fw={400}>
                {arbiterEnabled ? "(required for loop)" : "(optional)"}
              </Text>
            </>
          }
          value={initialPromptText}
          onChange={(e) => setInitialPromptText(e.target.value)}
          placeholder="What should the agent work on?"
          minRows={2}
          maxRows={4}
          autosize
          styles={INPUT_STYLES}
        />

        {/* YOLO mode toggle — hidden for plain terminal */}
        {agentType !== "terminal" && (
        <Stack gap="xs">
          <Group justify="space-between">
            <SectionTitle mb={0}>YOLO Mode</SectionTitle>
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

        {/* Sandbox toggle */}
        {sandboxAvailable && agentType !== "terminal" && (
          <Group justify="space-between">
            <Group gap="xs">
              <Shield size={14} color="var(--text-secondary)" />
              <SectionTitle mb={0}>Isolated Environment</SectionTitle>
            </Group>
            <Switch
              checked={sandboxed}
              onChange={(e) => setSandboxed(e.currentTarget.checked)}
              styles={{
                track: {
                  backgroundColor: sandboxed ? undefined : "var(--bg-tertiary)",
                  borderColor: "var(--bg-tertiary)",
                },
              }}
            />
          </Group>
        )}

        {/* Arbiter session toggle */}
        {agentType !== "terminal" && (
          <Stack gap="xs">
            <Group justify="space-between">
              <SectionTitle mb={0}>Arbiter Session</SectionTitle>
              <Switch
                checked={arbiterEnabled}
                onChange={(e) => setArbiterEnabled(e.currentTarget.checked)}
                color="cyan"
                styles={{
                  track: {
                    backgroundColor: arbiterEnabled ? undefined : "var(--bg-tertiary)",
                    borderColor: "var(--bg-tertiary)",
                  },
                }}
              />
            </Group>

            {arbiterEnabled && (
              <Stack gap="xs" pl="xs" style={{ borderLeft: "2px solid var(--border)" }}>
                <Group justify="space-between" align="center">
                  <Text size="xs" c="var(--text-secondary)">Max loops</Text>
                  <Group gap="xs" align="center">
                    <Slider
                      value={maxIterations}
                      onChange={setMaxIterations}
                      min={1}
                      max={50}
                      step={1}
                      style={{ width: 120 }}
                      color="cyan"
                      size="xs"
                      styles={{
                        track: { backgroundColor: "var(--bg-tertiary)" },
                      }}
                    />
                    <NumberInput
                      value={maxIterations}
                      onChange={(val) => setMaxIterations(typeof val === "number" ? Math.max(1, Math.min(50, val)) : 10)}
                      min={1}
                      max={50}
                      step={1}
                      size="xs"
                      style={{ width: 60 }}
                      styles={INPUT_STYLES}
                      hideControls
                    />
                  </Group>
                </Group>
                <Text size="xs" c="var(--text-tertiary)">
                  Each loop iteration uses one CLI session. Higher values increase token usage.
                </Text>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      {/* Footer */}
      <ModalFooter>
        <Button variant="subtle" onClick={onClose} styles={BUTTON_STYLES.subtle}>
          Cancel
        </Button>
        <Button onClick={handleStart} disabled={loading || !projectId || (arbiterEnabled && !initialPromptText.trim())} styles={BUTTON_STYLES.primary}>
          {loading ? "Starting..." : "Start Session"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
