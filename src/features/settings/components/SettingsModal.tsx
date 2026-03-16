import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { listCliModels, resetDatabase } from "@/lib/tauri";
import type { AppSettings, AgentType } from "@/types";
import {
  Modal,
  TextInput,
  NumberInput,
  Button,
  Group,
  Switch,
  Tabs,
  Textarea,
  ActionIcon,
  Code,
  Text,
  Stack,
  Select,
} from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, INPUT_STYLES, BUTTON_STYLES, switchStyles } from "@/constants/styles";
import { ModalFooter } from "@/components/ui/ModalFooter";
import classes from "./SettingsModal.module.css";

const SELECT_STYLES = {
  input: {
    ...INPUT_STYLES.input,
    fontSize: "12px",
  },
  label: {
    ...INPUT_STYLES.label,
  },
  dropdown: {
    backgroundColor: "var(--bg-secondary)",
    borderColor: "var(--border)",
  },
  option: {
    fontSize: "12px",
    color: "var(--text-primary)",
    "&[data-selected]": { backgroundColor: "var(--accent)" },
    "&[data-hovered]": { backgroundColor: "var(--bg-tertiary)" },
  },
};

const TEXTAREA_MONO_STYLES = {
  input: {
    ...INPUT_STYLES.input,
    fontFamily: "monospace",
    resize: "none" as const,
    fontSize: "12px",
  },
};

const TEXTINPUT_MONO_STYLES = {
  input: {
    ...INPUT_STYLES.input,
    fontFamily: "monospace",
    fontSize: "12px",
  },
};

const TABS_STYLES = {
  tab: {
    color: "var(--text-secondary)",
    fontSize: "12px",
    "&:hover": {
      color: "var(--text-primary)",
      backgroundColor: "var(--bg-tertiary)",
    },
    "&[data-active]": {
      color: "var(--bg-primary)",
      backgroundColor: "var(--accent)",
    },
  },
  list: {
    marginBottom: "16px",
    borderBottom: "1px solid var(--border)",
  },
};

interface SettingsModalProps {
  onClose: () => void;
}

type AgentTab = AgentType;
type TopTab = "global" | "agents" | "data";

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [draft, setDraft] = useState<AppSettings>(JSON.parse(JSON.stringify(settings)));
  const [activeTab, setActiveTab] = useState<TopTab>("global");
  const [activeAgentTab, setActiveAgentTab] = useState<AgentTab>("claude");
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => { setOpened(true); }, []);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [arbiterModelOptions, setArbiterModelOptions] = useState<string[]>([]);

  const providerOptions = [
    { value: "claude", label: "Claude Code" },
    { value: "gemini", label: "Gemini CLI" },
    { value: "copilot", label: "GitHub Copilot" },
    { value: "codex", label: "Codex CLI" },
  ];

  // Load available models when arbiter provider changes
  const arbiterProvider = draft.global.arbiter_provider || "claude";
  useEffect(() => {
    listCliModels(arbiterProvider)
      .then(setArbiterModelOptions)
      .catch(() => setArbiterModelOptions([]));
  }, [arbiterProvider]);

  const handleGlobalChange = <K extends keyof AppSettings["global"]>(
    key: K,
    value: AppSettings["global"][K],
  ) => {
    setDraft((d) => ({
      ...d,
      global: { ...d.global, [key]: value },
    }));
  };

  const handleAgentChange = <K extends keyof AppSettings["agents"][string]>(
    agent: AgentTab,
    key: K,
    value: AppSettings["agents"][string][K],
  ) => {
    setDraft((d) => ({
      ...d,
      agents: {
        ...d.agents,
        [agent]: { ...d.agents[agent], [key]: value },
      },
    }));
  };

  const handleCustomArgsChange = (agent: AgentTab, value: string) => {
    const args = value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    handleAgentChange(agent, "custom_args", args);
  };

  const handleAddEnvVar = (agent: AgentTab) => {
    if (!newEnvKey.trim()) return;
    const envVars = {
      ...(draft.agents[agent]?.env_vars ?? {}),
      [newEnvKey.trim()]: newEnvVal,
    };
    handleAgentChange(agent, "env_vars", envVars);
    setNewEnvKey("");
    setNewEnvVal("");
  };

  const handleRemoveEnvVar = (agent: AgentTab, key: string) => {
    const envVars = { ...(draft.agents[agent]?.env_vars ?? {}) };
    delete envVars[key];
    handleAgentChange(agent, "env_vars", envVars);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(draft);
      onClose();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const agentSettings = draft.agents[activeAgentTab] ?? {
    default_yolo_mode: false,
    custom_args: [],
    env_vars: {},
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Settings"
      size="lg"
      centered
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      styles={{
        ...MODAL_STYLES,
        body: {
          ...MODAL_STYLES.body,
          maxHeight: "calc(80vh - 120px)",
          overflowY: "auto",
        },
        content: {
          ...MODAL_STYLES.content,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as TopTab)}
        styles={TABS_STYLES}
        className={classes.content}
      >
        <Tabs.List>
          <Tabs.Tab value="global">Global</Tabs.Tab>
          <Tabs.Tab value="agents">Agents</Tabs.Tab>
          <Tabs.Tab value="data">Data</Tabs.Tab>
        </Tabs.List>

        {/* Global tab */}
        <Tabs.Panel value="global">
          <Stack gap="sm">
            {/* Font family */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Terminal Font Family
              </Text>
              <TextInput
                value={draft.global.font_family}
                onChange={(e) => handleGlobalChange("font_family", e.target.value)}
                size="xs"
                className={classes.inputWidth208}
                styles={INPUT_STYLES}
              />
            </Group>

            {/* Font size */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Terminal Font Size
              </Text>
              <NumberInput
                min={8}
                max={32}
                size="xs"
                value={draft.global.font_size}
                onChange={(val) =>
                  handleGlobalChange("font_size", typeof val === "number" ? val : parseInt(String(val), 10))
                }
                className={classes.inputWidth80}
                styles={INPUT_STYLES}
              />
            </Group>

            {/* Scrollback */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Scrollback Lines
              </Text>
              <NumberInput
                min={100}
                max={100000}
                step={1000}
                size="xs"
                value={draft.global.terminal_scrollback}
                onChange={(val) =>
                  handleGlobalChange(
                    "terminal_scrollback",
                    typeof val === "number" ? val : parseInt(String(val), 10),
                  )
                }
                className={classes.inputWidth112}
                styles={INPUT_STYLES}
              />
            </Group>

            {/* Notifications */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Notifications Enabled
              </Text>
              <Switch
                checked={draft.global.notifications_enabled}
                onChange={(e) =>
                  handleGlobalChange("notifications_enabled", e.currentTarget.checked)
                }
                color="accent"
                styles={switchStyles(draft.global.notifications_enabled)}
              />
            </Group>

            {/* Minimize to tray */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Minimize to Tray
              </Text>
              <Switch
                checked={draft.global.minimize_to_tray}
                onChange={(e) =>
                  handleGlobalChange("minimize_to_tray", e.currentTarget.checked)
                }
                color="accent"
                styles={switchStyles(draft.global.minimize_to_tray)}
              />
            </Group>

            {/* Arbiter timeout */}
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" className={classes.settingLabel}>
                  Arbiter Timeout
                </Text>
                <Text size="xs" className={classes.settingHint}>
                  Wait time before Arbiter answers automatically
                </Text>
              </div>
              <NumberInput
                min={1}
                max={120}
                size="xs"
                value={draft.global.arbiter_timeout_seconds}
                onChange={(val) =>
                  handleGlobalChange(
                    "arbiter_timeout_seconds",
                    typeof val === "number" ? val : parseInt(String(val), 10),
                  )
                }
                className={classes.inputWidth80}
                styles={INPUT_STYLES}
              />
            </Group>

            {/* Arbiter provider */}
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" className={classes.settingLabel}>
                  Arbiter Provider
                </Text>
                <Text size="xs" className={classes.settingHint}>
                  Which agent CLI the Arbiter uses
                </Text>
              </div>
              <Select
                data={providerOptions}
                value={draft.global.arbiter_provider || "claude"}
                size="xs"
                onChange={(val) => {
                  handleGlobalChange("arbiter_provider", val ?? "claude");
                  handleGlobalChange("arbiter_model", "");
                }}
                allowDeselect={false}
                className={classes.inputWidth208}
                styles={SELECT_STYLES}
              />
            </Group>

            {/* Arbiter model — only shown when provider has model aliases */}
            {arbiterModelOptions.length > 0 && (
              <Group justify="space-between" align="center">
                <div>
                  <Text size="sm" className={classes.settingLabel}>
                    Arbiter Model
                  </Text>
                  <Text size="xs" className={classes.settingHint}>
                    AI model the Arbiter uses
                  </Text>
                </div>
                <Select
                  data={[
                    { value: "", label: "Default" },
                    ...arbiterModelOptions.map((m) => ({ value: m, label: m })),
                  ]}
                  value={draft.global.arbiter_model || ""}
                  size="xs"
                  onChange={(val) => handleGlobalChange("arbiter_model", val ?? "")}
                  allowDeselect={false}
                  className={classes.inputWidth208}
                  styles={SELECT_STYLES}
                />
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Agents tab */}
        <Tabs.Panel value="agents">
          <Tabs
            value={activeAgentTab}
            onChange={(v) => setActiveAgentTab(v as AgentTab)}
            styles={TABS_STYLES}
          >
            <Tabs.List>
              <Tabs.Tab value="claude">Claude</Tabs.Tab>
              <Tabs.Tab value="gemini">Gemini</Tabs.Tab>
              <Tabs.Tab value="copilot">Copilot</Tabs.Tab>
              <Tabs.Tab value="codex">Codex</Tabs.Tab>
            </Tabs.List>

            {(["claude", "gemini", "copilot", "codex"] as AgentTab[]).map((agent) => (
              <Tabs.Panel key={agent} value={agent}>
                <Stack gap="md">
                  {/* Default YOLO */}
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" className={classes.settingLabel}>
                        Default Auto-approve
                      </Text>
                      <Text size="xs" className={classes.settingHint}>
                        Skip confirmation prompts by default
                      </Text>
                    </div>
                    <Switch
                      checked={agentSettings.default_yolo_mode}
                      onChange={(e) =>
                        handleAgentChange(
                          activeAgentTab,
                          "default_yolo_mode",
                          e.currentTarget.checked,
                        )
                      }
                      color="red"
                      styles={switchStyles(agentSettings.default_yolo_mode)}
                    />
                  </Group>

                  {/* Custom args */}
                  <div>
                    <Text size="sm" mb={6} className={classes.settingLabel}>
                      Custom Arguments
                      <Text
                        component="span"
                        size="xs"
                        c="var(--text-secondary)"
                        ml={8}
                        fw={400}
                      >
                        (one per line)
                      </Text>
                    </Text>
                    <Textarea
                      rows={3}
                      value={agentSettings.custom_args.join("\n")}
                      onChange={(e) =>
                        handleCustomArgsChange(activeAgentTab, e.target.value)
                      }
                      placeholder={"--verbose\n--no-cache"}
                      styles={TEXTAREA_MONO_STYLES}
                    />
                  </div>

                  {/* Env vars */}
                  <div>
                    <Text size="sm" mb={6} className={classes.settingLabel}>
                      Environment Variables
                    </Text>
                    <Stack gap="xs" className={classes.envVarsList}>
                      {Object.entries(agentSettings.env_vars ?? {}).map(([k, v]) => (
                        <Group key={k} gap="xs" wrap="nowrap">
                          <Code className={classes.envVarKey}>
                            {k}
                          </Code>
                          <Text size="xs" c="var(--text-secondary)">
                            =
                          </Text>
                          <Code className={classes.envVarValue}>
                            {v}
                          </Code>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => handleRemoveEnvVar(activeAgentTab, k)}
                            aria-label={`Remove env var ${k}`}
                            c="var(--danger)"
                          >
                            <Trash2 size={12} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        placeholder="KEY"
                        size="xs"
                        className={classes.flex1}
                        styles={TEXTINPUT_MONO_STYLES}
                      />
                      <Text size="xs" c="var(--text-secondary)">
                        =
                      </Text>
                      <TextInput
                        value={newEnvVal}
                        onChange={(e) => setNewEnvVal(e.target.value)}
                        placeholder="value"
                        size="xs"
                        className={classes.flex1}
                        styles={TEXTINPUT_MONO_STYLES}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddEnvVar(activeAgentTab);
                        }}
                      />
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleAddEnvVar(activeAgentTab)}
                        aria-label="Add environment variable"
                        c="var(--accent)"
                      >
                        <Plus size={14} />
                      </ActionIcon>
                    </Group>
                  </div>
                </Stack>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Tabs.Panel>

        {/* Data tab */}
        <Tabs.Panel value="data">
          <Stack gap="sm">
            <Text size="xs" c="var(--text-secondary)">
              Reset the database to start fresh. This deletes all projects, sessions, memories, and context.
            </Text>
            <div>
              <Button
                variant="outline"
                color="red"
                size="xs"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset database
              </Button>
            </div>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Reset database confirmation */}
      <Modal
        opened={showResetConfirm}
        onClose={() => !resetting && setShowResetConfirm(false)}
        title="Reset database"
        centered
        size="sm"
        overlayProps={MODAL_OVERLAY_PROPS}
        transitionProps={MODAL_TRANSITION_PROPS}
        styles={{
          ...MODAL_STYLES,
          body: { ...MODAL_STYLES.body, padding: 20 },
        }}
      >
        <Text size="sm" c="var(--text-secondary)" mb="md">
          This will delete all data and restart the app. This cannot be undone.
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setShowResetConfirm(false)}
            disabled={resetting}
            styles={BUTTON_STYLES.subtle}
          >
            Cancel
          </Button>
          <Button
            color="red"
            size="xs"
            onClick={() => {
              setResetting(true);
              resetDatabase().catch(() => {
                // App restarts after reset — ignore connection errors
              });
            }}
            disabled={resetting}
            styles={{
              root: {
                backgroundColor: "var(--danger)",
                color: "var(--bg-primary)",
                "&:hover": { backgroundColor: "color-mix(in srgb, var(--danger) 85%, white)" },
              },
            }}
          >
            {resetting ? "Restarting…" : "Reset database"}
          </Button>
        </Group>
      </Modal>

      {/* Footer */}
      <ModalFooter>
        <Button variant="subtle" onClick={onClose} styles={BUTTON_STYLES.subtle}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} styles={BUTTON_STYLES.primary}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
