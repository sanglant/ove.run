import { useState, useEffect } from "react";
import { AlertTriangle, Shield, FileText, Sparkles } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { listAgentTypes, setMaxIterations as setMaxIterationsFn, startLoop, listProjectFiles, listContextUnits } from "@/lib/tauri";
import { PromptEditor, type SuggestionItem } from "@/components/shared/PromptEditor";
import type { AgentType, AgentDefinition, AgentSession, TrustLevel } from "@/types";
import { TRUST_LEVEL_LABELS } from "@/types";
import {
  Modal,
  TextInput,
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
  const [opened, setOpened] = useState(false);
  useEffect(() => { setOpened(true); }, []);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [agentDefs, setAgentDefs] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [sandboxed, setSandboxed] = useState(false);
  const [arbiterEnabled, setArbiterEnabled] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(2);
  const [maxIterations, setMaxIterations] = useState(10);
  const [initialPromptText, setInitialPromptText] = useState(initialPrompt ?? "");
  const [fileItems, setFileItems] = useState<SuggestionItem[]>([]);
  const [skillItems, setSkillItems] = useState<SuggestionItem[]>([]);

  const { addSession } = useSessionStore();
  const { settings, sandboxAvailable } = useSettingsStore();
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  useEffect(() => {
    listAgentTypes()
      .then(setAgentDefs)
      .catch(() => {
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

  useEffect(() => {
    const projects = useProjectStore.getState().projects;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    listProjectFiles(project.path).then((paths) => {
      setFileItems(
        paths.map((p) => ({
          id: p,
          title: p,
          icon: <FileText size={14} />,
        })),
      );
    }).catch(() => {});

    listContextUnits(projectId).then((units) => {
      setSkillItems(
        units
          .filter((u) => u.type === "skill" || u.type === "persona" || u.type === "knowledge")
          .map((u) => ({
            id: u.bundled_slug ?? u.name.toLowerCase().replace(/\s+/g, "-"),
            title: u.name,
            description: u.l0_summary ?? undefined,
            icon: <Sparkles size={14} />,
          })),
      );
    }).catch(() => {});
  }, [projectId]);

  // Arbiter requires YOLO mode — force it on
  const effectiveYoloMode = arbiterEnabled ? true : yoloMode;

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
      yoloMode: effectiveYoloMode,
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
          await startLoop(projectId, project.path, initialPromptText.trim(), session.id);
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
      opened={opened}
      onClose={onClose}
      title="New Agent Session"
      centered
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      size={arbiterEnabled ? "lg" : "md"}
      styles={{
        ...MODAL_STYLES,
        content: { ...MODAL_STYLES.content, ...(arbiterEnabled ? {} : { width: "420px" }) },
        body: { ...MODAL_STYLES.body, maxHeight: "calc(100vh - 160px)", overflowY: "auto" },
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
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setAgentType(def.agent_type as AgentType)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAgentType(def.agent_type as AgentType);
                    }
                  }}
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
            if (e.key === "Enter" && !arbiterEnabled) handleStart();
          }}
        />

        {/* YOLO mode toggle — hidden for terminal and when arbiter forces it */}
        {agentType !== "terminal" && !arbiterEnabled && (
        <Stack gap="xs">
          <Group justify="space-between">
            <SectionTitle mb={0}>Auto-approve</SectionTitle>
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
              Auto-approve skips all confirmation prompts. The agent will
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
              <Stack gap="sm" pl="xs" style={{ borderLeft: "2px solid var(--border)" }}>
                {/* Trust level selector */}
                <div>
                  <Text size="xs" c="var(--text-secondary)" mb={4}>Trust level</Text>
                  <Stack gap={4}>
                    {([1, 2, 3] as TrustLevel[]).map((level) => {
                      const meta = TRUST_LEVEL_LABELS[level];
                      const isSelected = trustLevel === level;
                      return (
                        <Paper
                          key={level}
                          withBorder
                          px="sm"
                          py={6}
                          className={classes.agentCard}
                          styles={{
                            root: {
                              backgroundColor: isSelected
                                ? "color-mix(in srgb, #4ecdc4 8%, transparent)"
                                : "var(--bg-tertiary)",
                              borderColor: isSelected ? "#4ecdc4" : "var(--border)",
                            },
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => setTrustLevel(level)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setTrustLevel(level);
                            }
                          }}
                        >
                          <Group gap="xs">
                            <Text size="xs" fw={600} c={isSelected ? "#4ecdc4" : "var(--text-primary)"}>
                              {meta.name}
                            </Text>
                            <Text size="xs" c="var(--text-tertiary)">
                              {meta.description}
                            </Text>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </div>

                {/* Max loops */}
                <Group justify="space-between" align="center">
                  <Text size="xs" c="var(--text-secondary)">Max iterations</Text>
                  <Group gap="xs" align="center">
                    <Slider
                      value={maxIterations}
                      onChange={setMaxIterations}
                      min={1}
                      max={200}
                      step={1}
                      style={{ width: 140 }}
                      color="cyan"
                      size="xs"
                      styles={{
                        track: { backgroundColor: "var(--bg-tertiary)" },
                      }}
                    />
                    <NumberInput
                      value={maxIterations}
                      onChange={(val) => setMaxIterations(typeof val === "number" ? Math.max(1, Math.min(200, val)) : 10)}
                      min={1}
                      max={200}
                      step={1}
                      size="xs"
                      style={{ width: 80 }}
                      styles={INPUT_STYLES}
                    />
                  </Group>
                </Group>
                <Text size="xs" c="var(--text-tertiary)">
                  Each iteration spawns a fresh agent. Higher values increase token usage.
                </Text>

                {/* Initial prompt */}
                <div>
                  <Text size="xs" c="var(--text-secondary)" fw={500} mb={4}>
                    Initial prompt (required)
                  </Text>
                  <PromptEditor
                    value={initialPromptText}
                    onChange={setInitialPromptText}
                    placeholder="What should the agent work on? Use @ for files, / for skills"
                    files={fileItems}
                    skills={skillItems}
                  />
                </div>

                {/* YOLO forced note */}
                <Text size="xs" c="var(--text-tertiary)">
                  Auto-approve is enabled automatically for arbiter sessions.
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
          {loading ? "Starting..." : arbiterEnabled ? "Start Loop" : "Start Session"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
