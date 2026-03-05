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
      <Stack gap="xl" style={{ padding: "20px" }}>
        {/* Global settings */}
        <section>
          <Text
            size="xs"
            style={{
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            Global
          </Text>
          <Stack gap="sm">
            {/* Font family */}
            <Group justify="space-between" align="center">
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
                Terminal Font Family
              </Text>
              <TextInput
                value={draft.global.font_family}
                onChange={(e) => handleGlobalChange("font_family", e.target.value)}
                style={{ width: "208px" }}
                styles={inputStyles}
              />
            </Group>

            {/* Font size */}
            <Group justify="space-between" align="center">
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
                Terminal Font Size
              </Text>
              <NumberInput
                min={8}
                max={32}
                value={draft.global.font_size}
                onChange={(val) =>
                  handleGlobalChange("font_size", typeof val === "number" ? val : parseInt(String(val), 10))
                }
                style={{ width: "80px" }}
                styles={inputStyles}
              />
            </Group>

            {/* Scrollback */}
            <Group justify="space-between" align="center">
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
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
                style={{ width: "112px" }}
                styles={inputStyles}
              />
            </Group>

            {/* Notifications */}
            <Group justify="space-between" align="center">
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
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
              <Text size="sm" style={{ color: "var(--text-primary)" }}>
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
          </Stack>
        </section>

        {/* Agent settings */}
        <section>
          <Text
            size="xs"
            style={{
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
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
                      <Text size="sm" style={{ color: "var(--text-primary)" }}>
                        Default YOLO Mode
                      </Text>
                      <Text
                        size="xs"
                        style={{ color: "var(--text-secondary)", marginTop: "2px" }}
                      >
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
                    <Text size="sm" style={{ color: "var(--text-primary)", marginBottom: "6px" }}>
                      Custom Arguments
                      <Text
                        component="span"
                        size="xs"
                        style={{ color: "var(--text-secondary)", marginLeft: "8px", fontWeight: 400 }}
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
                    <Text size="sm" style={{ color: "var(--text-primary)", marginBottom: "6px" }}>
                      Environment Variables
                    </Text>
                    <Stack gap="xs" style={{ marginBottom: "8px" }}>
                      {Object.entries(agentSettings.env_vars ?? {}).map(([k, v]) => (
                        <Group key={k} gap="xs" wrap="nowrap">
                          <Code
                            style={{
                              flex: 1,
                              backgroundColor: "var(--bg-tertiary)",
                              color: "var(--accent)",
                              fontSize: "12px",
                              padding: "4px 8px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {k}
                          </Code>
                          <Text size="xs" style={{ color: "var(--text-secondary)" }}>
                            =
                          </Text>
                          <Code
                            style={{
                              flex: 1,
                              backgroundColor: "var(--bg-tertiary)",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                              padding: "4px 8px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {v}
                          </Code>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => handleRemoveEnvVar(activeAgentTab, k)}
                            aria-label={`Remove env var ${k}`}
                            style={{ color: "var(--danger)" }}
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
                        style={{ flex: 1 }}
                        styles={{
                          input: {
                            ...inputStyles.input,
                            fontFamily: "monospace",
                            fontSize: "12px",
                          },
                        }}
                      />
                      <Text size="xs" style={{ color: "var(--text-secondary)" }}>
                        =
                      </Text>
                      <TextInput
                        value={newEnvVal}
                        onChange={(e) => setNewEnvVal(e.target.value)}
                        placeholder="value"
                        style={{ flex: 1 }}
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
                        style={{ color: "var(--accent)" }}
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
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 20px",
          flexShrink: 0,
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
