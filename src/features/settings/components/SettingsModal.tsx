import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AppSettings, AgentType } from "@/types";

interface SettingsModalProps {
  onClose: () => void;
}

type AgentTab = AgentType;

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const agentSettings = draft.agents[activeAgentTab] ?? {
    default_yolo_mode: false,
    custom_args: [],
    env_vars: {},
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg w-[580px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h2 id="settings-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Global settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
              Global
            </h3>
            <div className="space-y-3">
              {/* Font family */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-primary)]">
                  Terminal Font Family
                </label>
                <input
                  type="text"
                  value={draft.global.font_family}
                  onChange={(e) => handleGlobalChange("font_family", e.target.value)}
                  className="w-52 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Font size */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-primary)]">
                  Terminal Font Size
                </label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={draft.global.font_size}
                  onChange={(e) =>
                    handleGlobalChange("font_size", parseInt(e.target.value, 10))
                  }
                  className="w-20 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Scrollback */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-primary)]">
                  Scrollback Lines
                </label>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={1000}
                  value={draft.global.terminal_scrollback}
                  onChange={(e) =>
                    handleGlobalChange(
                      "terminal_scrollback",
                      parseInt(e.target.value, 10),
                    )
                  }
                  className="w-28 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-primary)]">
                  Notifications Enabled
                </label>
                <button
                  role="switch"
                  aria-checked={draft.global.notifications_enabled}
                  onClick={() =>
                    handleGlobalChange(
                      "notifications_enabled",
                      !draft.global.notifications_enabled,
                    )
                  }
                  className={[
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    draft.global.notifications_enabled
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--bg-tertiary)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      draft.global.notifications_enabled
                        ? "translate-x-4"
                        : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Minimize to tray */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-primary)]">
                  Minimize to Tray
                </label>
                <button
                  role="switch"
                  aria-checked={draft.global.minimize_to_tray}
                  onClick={() =>
                    handleGlobalChange(
                      "minimize_to_tray",
                      !draft.global.minimize_to_tray,
                    )
                  }
                  className={[
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    draft.global.minimize_to_tray
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--bg-tertiary)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      draft.global.minimize_to_tray
                        ? "translate-x-4"
                        : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Agent settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
              Agent Settings
            </h3>

            {/* Agent tabs */}
            <div className="flex gap-1 mb-4">
              {(["claude", "gemini"] as AgentTab[]).map((agent) => (
                <button
                  key={agent}
                  onClick={() => setActiveAgentTab(agent)}
                  className={[
                    "px-4 py-1.5 text-xs rounded transition-colors capitalize",
                    activeAgentTab === agent
                      ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                  ].join(" ")}
                >
                  {agent === "claude" ? "Claude" : "Gemini"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Default YOLO */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-primary)]">
                    Default YOLO Mode
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Skip confirmation prompts by default
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={agentSettings.default_yolo_mode}
                  onClick={() =>
                    handleAgentChange(
                      activeAgentTab,
                      "default_yolo_mode",
                      !agentSettings.default_yolo_mode,
                    )
                  }
                  className={[
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    agentSettings.default_yolo_mode
                      ? "bg-[var(--danger)]"
                      : "bg-[var(--bg-tertiary)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      agentSettings.default_yolo_mode
                        ? "translate-x-4"
                        : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Custom args */}
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-1.5">
                  Custom Arguments
                  <span className="text-xs text-[var(--text-secondary)] ml-2 font-normal">
                    (one per line)
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={agentSettings.custom_args.join("\n")}
                  onChange={(e) =>
                    handleCustomArgsChange(activeAgentTab, e.target.value)
                  }
                  placeholder="--verbose&#10;--no-cache"
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono resize-none"
                />
              </div>

              {/* Env vars */}
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-1.5">
                  Environment Variables
                </label>
                <div className="space-y-1.5 mb-2">
                  {Object.entries(agentSettings.env_vars ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs font-mono text-[var(--accent)] truncate">
                        {k}
                      </code>
                      <span className="text-[var(--text-secondary)]">=</span>
                      <code className="flex-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs font-mono text-[var(--text-primary)] truncate">
                        {v}
                      </code>
                      <button
                        onClick={() => handleRemoveEnvVar(activeAgentTab, k)}
                        aria-label={`Remove env var ${k}`}
                        className="text-[var(--danger)] hover:text-[var(--danger)] opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    placeholder="KEY"
                    className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[var(--text-secondary)]">=</span>
                  <input
                    type="text"
                    value={newEnvVal}
                    onChange={(e) => setNewEnvVal(e.target.value)}
                    placeholder="value"
                    className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddEnvVar(activeAgentTab);
                    }}
                  />
                  <button
                    onClick={() => handleAddEnvVar(activeAgentTab)}
                    aria-label="Add environment variable"
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
