import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
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
} from "@mantine/core";
import classes from "./SettingsModal.module.css";

interface SettingsModalProps {
  onClose: () => void;
}

type AgentTab = AgentType;

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

const switchStyles = (active: boolean) => ({
  track: {
    backgroundColor: active ? undefined : "var(--bg-tertiary)",
    borderColor: "var(--bg-tertiary)",
  },
});

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [draft, setDraft] = useState<AppSettings>(JSON.parse(JSON.stringify(settings)));
  const [activeAgentTab, setActiveAgentTab] = useState<AgentTab>("claude");
  const [saving, setSaving] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

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
      opened={true}
      onClose={onClose}
      title="Settings"
      size="lg"
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
          maxHeight: "calc(80vh - 120px)",
          overflowY: "auto",
        },
        content: {
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-bright)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        },
        close: {
          color: "var(--text-secondary)",
        },
      }}
    >
      {/* Content */}
      <Stack gap="xl" className={classes.content}>
        {/* Global settings */}
        <section>
          <Text size="xs" className={classes.sectionTitle}>
            Global
          </Text>
          <Stack gap="sm">
            {/* Font family */}
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.settingLabel}>
                Terminal Font Family
              </Text>
              <TextInput
                value={draft.global.font_family}
                onChange={(e) => handleGlobalChange("font_family", e.target.value)}
                className={classes.inputWidth208}
                styles={inputStyles}
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
                value={draft.global.font_size}
                onChange={(val) =>
                  handleGlobalChange("font_size", typeof val === "number" ? val : parseInt(String(val), 10))
                }
                className={classes.inputWidth80}
                styles={inputStyles}
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
                value={draft.global.terminal_scrollback}
                onChange={(val) =>
                  handleGlobalChange(
                    "terminal_scrollback",
                    typeof val === "number" ? val : parseInt(String(val), 10),
                  )
                }
                className={classes.inputWidth112}
                styles={inputStyles}
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

            {/* Guardian timeout */}
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" className={classes.settingLabel}>
                  Guardian Timeout
                </Text>
                <Text size="xs" className={classes.settingHint}>
                  Seconds before guardian auto-answers
                </Text>
              </div>
              <NumberInput
                min={5}
                max={120}
                value={draft.global.guardian_timeout_seconds}
                onChange={(val) =>
                  handleGlobalChange(
                    "guardian_timeout_seconds",
                    typeof val === "number" ? val : parseInt(String(val), 10),
                  )
                }
                className={classes.inputWidth80}
                styles={inputStyles}
              />
            </Group>
          </Stack>
        </section>

        {/* Agent settings */}
        <section>
          <Text size="xs" className={classes.sectionTitle}>
            Agent Settings
          </Text>

          <Tabs
            value={activeAgentTab}
            onChange={(v) => setActiveAgentTab(v as AgentTab)}
            styles={{
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
            }}
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
                        Default YOLO Mode
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
                      styles={{
                        input: {
                          ...inputStyles.input,
                          fontFamily: "monospace",
                          resize: "none" as const,
                          fontSize: "12px",
                        },
                      }}
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
                        className={classes.flex1}
                        styles={{
                          input: {
                            ...inputStyles.input,
                            fontFamily: "monospace",
                            fontSize: "12px",
                          },
                        }}
                      />
                      <Text size="xs" c="var(--text-secondary)">
                        =
                      </Text>
                      <TextInput
                        value={newEnvVal}
                        onChange={(e) => setNewEnvVal(e.target.value)}
                        placeholder="value"
                        className={classes.flex1}
                        styles={{
                          input: {
                            ...inputStyles.input,
                            fontFamily: "monospace",
                            fontSize: "12px",
                          },
                        }}
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
        </section>
      </Stack>

      {/* Footer */}
      <div className={classes.footer}>
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
            onClick={handleSave}
            disabled={saving}
            styles={{
              root: {
                backgroundColor: "var(--accent)",
                color: "var(--bg-primary)",
                "&:hover": { backgroundColor: "var(--accent-hover)" },
                "&:disabled": { opacity: 0.5 },
              },
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </Group>
      </div>
    </Modal>
  );
}
