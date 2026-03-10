import { useState } from "react";
import { TextInput } from "@mantine/core";
import { INPUT_STYLES } from "@/constants/styles";
import { saveBugProviderConfig, startBugOauth, checkBugAuth } from "@/lib/tauri";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { BugProviderType, ProviderConfig } from "../types";
import cn from "clsx";
import classes from "./ProviderSetup.module.css";

interface ProviderCard {
  type: BugProviderType;
  name: string;
  description: string;
  icon: string;
  requiresBaseUrl: boolean;
  projectKeyLabel: string;
  projectKeyPlaceholder: string;
}

const PROVIDERS: ProviderCard[] = [
  {
    type: "jira",
    name: "Jira",
    description: "Atlassian project and issue tracking",
    icon: "J",
    requiresBaseUrl: false,
    projectKeyLabel: "Project Key",
    projectKeyPlaceholder: "e.g. PROJ",
  },
  {
    type: "github_projects",
    name: "GitHub Issues",
    description: "Track bugs with GitHub Issues",
    icon: "G",
    requiresBaseUrl: false,
    projectKeyLabel: "Repository",
    projectKeyPlaceholder: "e.g. owner/repo",
  },
  {
    type: "youtrack",
    name: "YouTrack",
    description: "JetBrains issue tracker",
    icon: "Y",
    requiresBaseUrl: true,
    projectKeyLabel: "Project Key",
    projectKeyPlaceholder: "e.g. DEMO",
  },
];

interface ProviderSetupProps {
  projectId: string;
  onConfigured: () => void;
}

export function ProviderSetup({ projectId, onConfigured }: ProviderSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderCard | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    selectedProvider !== null &&
    clientId.trim() !== "" &&
    clientSecret.trim() !== "" &&
    projectKey.trim() !== "" &&
    (!selectedProvider.requiresBaseUrl || baseUrl.trim() !== "");

  const handleSave = async () => {
    if (!selectedProvider || !canSave) return;

    setSaving(true);
    setError(null);
    try {
      const config: ProviderConfig = {
        provider: selectedProvider.type,
        project_key: projectKey.trim(),
        base_url: baseUrl.trim() || null,
        board_id: null,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      };
      await saveBugProviderConfig(projectId, config);
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { auth_url } = await startBugOauth(projectId);
      await shellOpen(auth_url);
      // Poll for auth completion (background task handles the callback)
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const authed = await checkBugAuth(projectId);
        if (authed) {
          onConfigured();
          return;
        }
      }
      setError("Authentication timed out. Please try again.");
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  const inputStyles = {
    input: {
      ...INPUT_STYLES.input,
      fontSize: "12px",
    },
    label: {
      ...INPUT_STYLES.label,
      marginBottom: "6px",
    },
  };

  return (
    <div className={classes.root}>
      <div className={classes.inner}>
        <div className={classes.header}>
          <p className={classes.eyebrow}>Delegate bug fixing</p>
          <h2 className={classes.title}>Connect Bug Tracker</h2>
          <p className={classes.subtitle}>
            Choose a provider, enter your OAuth credentials, then authenticate to sync issues.
          </p>
        </div>

        {/* Provider selection grid */}
        <div className={classes.providerGrid}>
          {PROVIDERS.map((provider) => {
            const isSelected = selectedProvider?.type === provider.type;
            return (
              <button
                key={provider.type}
                type="button"
                className={cn(classes.providerCard, isSelected && classes.providerCardActive)}
                onClick={() => {
                  setSelectedProvider(provider);
                  setSaved(false);
                  setError(null);
                }}
                aria-pressed={isSelected}
              >
                <span
                  className={cn(classes.providerIcon, isSelected && classes.providerIconActive)}
                >
                  {provider.icon}
                </span>
                <span className={classes.providerName}>{provider.name}</span>
                <span className={classes.providerDesc}>{provider.description}</span>
              </button>
            );
          })}
        </div>

        {/* Config form */}
        {selectedProvider && (
          <div className={classes.form}>
            <p className={classes.oauthHint}>
              {selectedProvider.type === "jira" && (
                <>Create an OAuth 2.0 (3LO) app at <a href="#" onClick={(e) => { e.preventDefault(); void shellOpen("https://developer.atlassian.com/console/myapps/"); }}>developer.atlassian.com</a>. Set the callback URL to <code>http://127.0.0.1</code>.</>
              )}
              {selectedProvider.type === "github_projects" && (
                <>Create an OAuth App at <a href="#" onClick={(e) => { e.preventDefault(); void shellOpen("https://github.com/settings/developers"); }}>GitHub Developer Settings</a>. Set the callback URL to <code>http://127.0.0.1</code>.</>
              )}
              {selectedProvider.type === "youtrack" && (
                <>Register a service in your YouTrack Hub settings under <strong>OAuth 2.0</strong>. Set the redirect URI to <code>http://127.0.0.1</code>.</>
              )}
            </p>
            <div className={classes.formGrid}>
              <TextInput
                label="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="OAuth client ID"
                styles={inputStyles}
                required
              />
              <TextInput
                label="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="OAuth client secret"
                type="password"
                styles={inputStyles}
                required
              />
              <TextInput
                label={selectedProvider.projectKeyLabel}
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder={selectedProvider.projectKeyPlaceholder}
                styles={inputStyles}
                required
              />
              {(selectedProvider.requiresBaseUrl || selectedProvider.type !== "github_projects") && (
                <TextInput
                  label={`Base URL${selectedProvider.requiresBaseUrl ? "" : " (optional)"}`}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    selectedProvider.type === "youtrack"
                      ? "https://youtrack.example.com"
                      : "https://your-domain.atlassian.net"
                  }
                  styles={inputStyles}
                  required={selectedProvider.requiresBaseUrl}
                />
              )}
            </div>

            {error && (
              <p className={classes.errorMessage}>{error}</p>
            )}

            <div className={classes.formActions}>
              {!saved ? (
                <button
                  type="button"
                  className={classes.primaryButton}
                  onClick={() => void handleSave()}
                  disabled={saving || !canSave}
                >
                  {saving ? "Saving…" : "Save Configuration"}
                </button>
              ) : (
                <button
                  type="button"
                  className={classes.connectButton}
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                >
                  {connecting ? "Waiting for authentication…" : "Connect with OAuth"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
