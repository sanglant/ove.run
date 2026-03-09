import { useState, useEffect } from "react";
import { Bug, RefreshCw, Settings } from "lucide-react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useProjectStore } from "@/stores/projectStore";
import { useBugsStore } from "@/stores/bugsStore";
import { startBugOauth, checkBugAuth, disconnectBugProvider } from "@/lib/tauri";
import { ProviderSetup } from "./ProviderSetup";
import { BugDetailView } from "./BugDetailView";
import { NewAgentDialog } from "@/features/agents/components/NewAgentDialog";
import type { BugItem } from "../types";
import classes from "./BugsPanel.module.css";

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return classes.statusDone;
  if (s.includes("progress") || s.includes("review") || s.includes("testing")) return classes.statusInProgress;
  if (s.includes("backlog") || s.includes("todo") || s.includes("open")) return classes.statusOpen;
  return classes.statusDefault;
}

function priorityDotClass(priority: string | null): string {
  if (!priority) return classes.priorityDefault;
  const p = priority.toLowerCase();
  if (p === "critical" || p === "blocker") return classes.priorityCritical;
  if (p === "high") return classes.priorityHigh;
  if (p === "medium" || p === "normal") return classes.priorityMedium;
  if (p === "low" || p === "minor") return classes.priorityLow;
  return classes.priorityDefault;
}

export function BugsPanel() {
  const { activeProjectId } = useProjectStore();
  const {
    bugs,
    selectedBug,
    loading,
    providerConfig,
    authenticated,
    loadConfig,
    loadBugs,
    selectBug,
    clearSelection,
    reset,
  } = useBugsStore();

  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [delegatePrompt, setDelegatePrompt] = useState<string | null>(null);
  const [delegateLabel, setDelegateLabel] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!activeProjectId) {
      reset();
      return;
    }
    void (async () => {
      await loadConfig(activeProjectId);
    })();
  }, [activeProjectId, loadConfig, reset]);

  // Load bugs when authenticated
  useEffect(() => {
    if (activeProjectId && authenticated) {
      void loadBugs(activeProjectId);
    }
  }, [activeProjectId, authenticated, loadBugs]);

  const handleConnect = async () => {
    if (!activeProjectId) return;
    setConnecting(true);
    try {
      const { auth_url } = await startBugOauth(activeProjectId);
      await shellOpen(auth_url);
      // Poll for auth completion (background task handles the callback)
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const authed = await checkBugAuth(activeProjectId);
        if (authed) {
          await loadConfig(activeProjectId);
          return;
        }
      }
      console.error("OAuth timed out");
    } catch (e) {
      console.error("OAuth failed:", e);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeProjectId) return;
    try {
      await disconnectBugProvider(activeProjectId);
      reset();
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  const handleRefreshBugs = async () => {
    if (!activeProjectId || !authenticated) return;
    await loadBugs(activeProjectId);
  };

  const handleSelectBug = (bug: BugItem) => {
    if (!activeProjectId) return;
    void selectBug(activeProjectId, bug);
  };

  const handleDelegate = (prompt: string, label: string) => {
    setDelegateLabel(label);
    setDelegatePrompt(prompt);
  };

  const filteredBugs = bugs.filter((bug) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      bug.key.toLowerCase().includes(q) ||
      bug.title.toLowerCase().includes(q) ||
      bug.status.toLowerCase().includes(q)
    );
  });

  if (!activeProjectId) {
    return (
      <div className={classes.emptyState}>
        <Bug size={34} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to view its bug tracker.</p>
      </div>
    );
  }

  // No provider configured or in setup mode
  if (!providerConfig || showSettings) {
    return (
      <div style={{ height: "100%", overflow: "hidden" }}>
        {showSettings && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className={classes.iconButton}
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
        )}
        <ProviderSetup
          projectId={activeProjectId}
          onConfigured={async () => {
            setShowSettings(false);
            await loadConfig(activeProjectId);
          }}
        />
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <aside className={classes.sidebar} aria-label="Bug list navigation">
        <div className={classes.sidebarHeader}>
          <div>
            <p className={classes.sidebarEyebrow}>{providerConfig.provider.replace("_", " ")}</p>
            <div className={classes.sidebarTitleRow}>
              <Bug size={15} className={classes.sidebarTitleIcon} />
              <h2 className={classes.sidebarTitle}>Bugs</h2>
              <span className={classes.countBadge}>{bugs.length}</span>
            </div>
            <p className={classes.sidebarDescription}>
              {providerConfig.project_key}
            </p>
          </div>
          <div className={classes.headerButtons}>
            <button
              type="button"
              className={classes.iconButton}
              onClick={() => void handleRefreshBugs()}
              disabled={loading}
              aria-label="Refresh bugs"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? classes.iconButtonSpin : undefined} />
            </button>
            <button
              type="button"
              className={classes.iconButton}
              onClick={() => setShowSettings(true)}
              aria-label="Bug tracker settings"
              title="Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        <div className={classes.searchWrap}>
          <input
            type="search"
            className={classes.searchInput}
            placeholder="Search bugs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bugs"
          />
        </div>

        <div className={classes.list} role="list">
          {loading ? (
            <div className={classes.listMessage}>Loading bugs…</div>
          ) : filteredBugs.length === 0 ? (
            <div className={classes.listEmpty}>
              <Bug size={24} strokeWidth={1} className={classes.emptyListIcon} />
              <p>{bugs.length === 0 ? "No bugs found." : "No results for that query."}</p>
              <span>{bugs.length === 0 ? "Refresh to fetch issues from your tracker." : "Try a different search term."}</span>
            </div>
          ) : (
            filteredBugs.map((bug) => {
              const isSelected = selectedBug?.id === bug.id;
              return (
                <div
                  key={bug.id}
                  className={`${classes.listItem} ${isSelected ? classes.listItemActive : ""}`}
                  role="listitem"
                >
                  <div className={classes.cardAccent} aria-hidden="true" />
                  <div
                    className={classes.bugCard}
                    onClick={() => handleSelectBug(bug)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectBug(bug);
                      }
                    }}
                  >
                    <div className={classes.bugCardTopRow}>
                      <span className={classes.bugKey}>{bug.key}</span>
                      {bug.priority && (
                        <span
                          className={`${classes.priorityDot} ${priorityDotClass(bug.priority)}`}
                          title={bug.priority}
                          aria-label={`Priority: ${bug.priority}`}
                        />
                      )}
                    </div>
                    <span className={classes.bugTitle}>{bug.title}</span>
                    <div className={classes.bugMetaRow}>
                      <span className={`${classes.statusBadge} ${statusClass(bug.status)}`}>
                        {bug.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className={classes.mainArea}>
        {!authenticated ? (
          <div className={classes.connectArea}>
            <Bug size={34} strokeWidth={1} className={classes.emptyIcon} />
            <p>Authentication required to load issues from {providerConfig.provider.replace("_", " ")}.</p>
            <button
              type="button"
              className={classes.connectButton}
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              {connecting ? "Waiting for authentication…" : "Connect with OAuth"}
            </button>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer", marginTop: 4 }}
              onClick={() => void handleDisconnect()}
            >
              Remove configuration
            </button>
          </div>
        ) : selectedBug ? (
          <BugDetailView
            bug={selectedBug}
            onDelegate={handleDelegate}
          />
        ) : (
          <div className={classes.emptyState}>
            <Bug size={42} strokeWidth={1} className={classes.emptyIcon} />
            <p>Select a bug to view its details.</p>
          </div>
        )}
      </main>

      {delegatePrompt !== null && activeProjectId && (
        <NewAgentDialog
          projectId={activeProjectId}
          initialLabel={delegateLabel}
          initialPrompt={delegatePrompt}
          onClose={() => {
            setDelegatePrompt(null);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
