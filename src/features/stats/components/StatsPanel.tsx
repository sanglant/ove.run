import { useEffect, useState, useMemo, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  StickyNote,
  Brain,
  RotateCw,
  Terminal,
  Shield,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useSessionStore } from "@/stores/sessionStore";
import {
  listNotes,
  listContextUnits,
  listMemories,
  listConsolidations,
  getArbiterState,
  listStories,
} from "@/lib/tauri";
import type { Note, ContextUnit, Memory, Consolidation, ArbiterState, Story } from "@/types";
import { AGENT_META } from "@/constants/agents";
import { EmptyState } from "@/components/ui/EmptyState";
import cn from "clsx";
import classes from "./StatsPanel.module.css";

interface ProjectStats {
  notes: Note[];
  contextUnits: ContextUnit[];
  memories: Memory[];
  consolidations: Consolidation[];
  arbiterState: ArbiterState | null;
  stories: Story[];
}

const STORY_STATUS_COLORS: Record<string, string> = {
  pending: "var(--text-secondary)",
  in_progress: "var(--accent)",
  completed: "var(--success)",
  failed: "var(--danger)",
  skipped: "color-mix(in srgb, var(--text-secondary) 50%, transparent)",
};

function getSkillLevel(unit: ContextUnit): number {
  let level = 0;
  if (unit.l0_summary) level++;
  if (unit.l1_overview) level++;
  if (unit.l2_content) level++;
  return level;
}

export function StatsPanel() {
  const { activeProjectId, projects } = useProjectStore();
  const { sessions } = useSessionStore();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(false);
  const loadTokenRef = useRef(0);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!activeProjectId) {
      setStats(null);
      return;
    }

    const token = ++loadTokenRef.current;
    setLoading(true);

    Promise.all([
      listNotes(activeProjectId),
      listContextUnits(activeProjectId),
      listMemories(activeProjectId),
      listConsolidations(activeProjectId),
      getArbiterState(activeProjectId),
      listStories(activeProjectId),
    ])
      .then(([notes, contextUnits, memories, consolidations, arbiterState, stories]) => {
        if (loadTokenRef.current !== token) return;
        setStats({ notes, contextUnits, memories, consolidations, arbiterState, stories });
      })
      .catch((err) => {
        if (loadTokenRef.current !== token) return;
        console.error("Failed to load stats:", err);
      })
      .finally(() => {
        if (loadTokenRef.current !== token) return;
        setLoading(false);
      });
  }, [activeProjectId]);

  const projectSessions = useMemo(
    () => sessions.filter((s) => s.projectId === activeProjectId),
    [sessions, activeProjectId],
  );

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of projectSessions) {
      counts[s.agentType] = (counts[s.agentType] ?? 0) + 1;
    }
    return counts;
  }, [projectSessions]);

  const skills = useMemo(
    () => stats?.contextUnits.filter((u) => u.type === "skill") ?? [],
    [stats],
  );

  const contextByType = useMemo(() => {
    if (!stats) return { persona: 0, skill: 0, knowledge: 0, reference: 0 };
    const counts = { persona: 0, skill: 0, knowledge: 0, reference: 0 };
    for (const u of stats.contextUnits) {
      if (u.type in counts) counts[u.type as keyof typeof counts]++;
    }
    return counts;
  }, [stats]);

  const storyCounts = useMemo(() => {
    if (!stats) return {};
    const counts: Record<string, number> = {};
    for (const s of stats.stories) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    }
    return counts;
  }, [stats]);

  const notesInContext = useMemo(
    () => stats?.notes.filter((n) => n.include_in_context).length ?? 0,
    [stats],
  );

  if (!activeProjectId || !activeProject) {
    return (
      <EmptyState
        icon={<BarChart3 size={40} strokeWidth={1} />}
        title="Select a project to view usage stats"
      />
    );
  }

  if (loading || !stats) {
    return (
      <div className={classes.emptyState}>
        <p>Loading stats…</p>
      </div>
    );
  }

  const totalIterations = stats.arbiterState?.iteration_count ?? 0;
  const loopStatus = stats.arbiterState?.loop_status ?? "idle";
  const trustLevel = stats.arbiterState?.trust_level ?? null;

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.headerTitle}>
          <BarChart3 size={15} className={classes.headerIcon} />
          <h2 className={classes.title}>Stats</h2>
        </div>
        <p className={classes.headerSub}>{activeProject.name}</p>
      </div>

      <div className={classes.body}>
        {/* Overview cards */}
        <div className={classes.cardsGrid}>
          <div className={classes.statCard} aria-label={`${projectSessions.length} sessions`}>
            <span className={classes.statCardLabel}>Sessions</span>
            <span className={classes.statCardValue}>{projectSessions.length}</span>
          </div>
          <div className={classes.statCard} aria-label={`${totalIterations} loop iterations`}>
            <span className={classes.statCardLabel}>Loop Iterations</span>
            <span className={cn(classes.statCardValue, totalIterations > 0 && classes.statCardAccent)}>
              {totalIterations}
            </span>
          </div>
          <div className={classes.statCard} aria-label={`${stats.notes.length} notes`}>
            <span className={classes.statCardLabel}>Notes</span>
            <span className={classes.statCardValue}>{stats.notes.length}</span>
          </div>
          <div className={classes.statCard} aria-label={`${stats.contextUnits.length} context entries`}>
            <span className={classes.statCardLabel}>Context Entries</span>
            <span className={classes.statCardValue}>{stats.contextUnits.length}</span>
          </div>
          <div className={classes.statCard} aria-label={`${stats.memories.length} memories`}>
            <span className={classes.statCardLabel}>Memories</span>
            <span className={classes.statCardValue}>{stats.memories.length}</span>
          </div>
          <div className={classes.statCard} aria-label={`${stats.consolidations.length} summaries`}>
            <span className={classes.statCardLabel}>Summaries</span>
            <span className={classes.statCardValue}>{stats.consolidations.length}</span>
          </div>
        </div>

        {/* Loop & Stories — front-loaded for ove.run's core value */}
        <div className={classes.section}>
          <div className={classes.sectionHeader}>
            <RotateCw size={12} className={classes.sectionIcon} />
            <h3 className={classes.sectionTitle}>Loop Engine</h3>
          </div>
          <div className={classes.statusGrid}>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Status</span>
              <span className={classes.statusCount} style={{ textTransform: "capitalize" }}>{loopStatus}</span>
            </div>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Iterations</span>
              <span className={classes.statusCount}>{totalIterations}</span>
            </div>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Total Stories</span>
              <span className={classes.statusCount}>{stats.stories.length}</span>
            </div>
          </div>
          {stats.stories.length > 0 && (
            <div className={classes.statusGrid}>
              {Object.entries(storyCounts).map(([status, count]) => (
                <div key={status} className={classes.statusItem}>
                  <span
                    className={classes.statusDot}
                    style={{ background: STORY_STATUS_COLORS[status] ?? "var(--text-secondary)" }}
                  />
                  <span className={classes.statusLabel} style={{ textTransform: "capitalize" }}>
                    {status.replace("_", " ")}
                  </span>
                  <span className={classes.statusCount}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Arbiter */}
        <div className={classes.section}>
          <div className={classes.sectionHeader}>
            <Shield size={12} className={classes.sectionIcon} />
            <h3 className={classes.sectionTitle}>Arbiter</h3>
          </div>
          <div className={classes.statusGrid}>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Enabled</span>
              <span className={classes.statusCount}>{activeProject.arbiter_enabled ? "Yes" : "No"}</span>
            </div>
            {trustLevel !== null && (
              <div className={classes.statusItem}>
                <span className={classes.statusLabel}>Trust Level</span>
                <span className={classes.statusCount}>
                  {trustLevel === 1 ? "Supervised" : trustLevel === 2 ? "Autonomous" : "Full Auto"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Agent sessions breakdown */}
        {Object.keys(agentCounts).length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionHeader}>
              <Terminal size={12} className={classes.sectionIcon} />
              <h3 className={classes.sectionTitle}>Sessions by Agent</h3>
            </div>
            <div className={classes.agentGrid}>
              {Object.entries(agentCounts).map(([agentType, count]) => {
                const meta = AGENT_META[agentType];
                return (
                  <div key={agentType} className={classes.agentItem}>
                    <span
                      className={classes.agentIcon}
                      style={{ "--agent-color": meta?.color ?? "var(--text-secondary)" } as React.CSSProperties}
                    >
                      {meta?.label ?? "?"}
                    </span>
                    <span className={classes.agentLabel}>{meta?.displayName ?? agentType}</span>
                    <span className={classes.agentCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skills usage with levels */}
        {skills.length > 0 && (
          <div className={classes.section}>
            <div className={classes.sectionHeader}>
              <BookOpen size={12} className={classes.sectionIcon} />
              <h3 className={classes.sectionTitle}>Skills ({skills.length})</h3>
            </div>
            <div className={classes.skillList}>
              {skills.map((skill) => {
                const level = getSkillLevel(skill);
                return (
                  <div key={skill.id} className={classes.skillRow}>
                    <span className={classes.skillName}>{skill.name}</span>
                    <div className={classes.skillLevels}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={cn(classes.levelDot, i < level && classes.levelDotFilled)}
                          title={["L0 Summary", "L1 Overview", "L2 Content"][i]}
                        />
                      ))}
                      <span className={classes.levelLabel}>L{level}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Context units breakdown */}
        <div className={classes.section}>
          <div className={classes.sectionHeader}>
            <BookOpen size={12} className={classes.sectionIcon} />
            <h3 className={classes.sectionTitle}>Context by Type</h3>
          </div>
          <div className={classes.statusGrid}>
            {Object.entries(contextByType).map(([type, count]) => (
              <div key={type} className={classes.statusItem}>
                <span className={classes.statusLabel} style={{ textTransform: "capitalize" }}>{type}s</span>
                <span className={classes.statusCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes detail */}
        <div className={classes.section}>
          <div className={classes.sectionHeader}>
            <StickyNote size={12} className={classes.sectionIcon} />
            <h3 className={classes.sectionTitle}>Notes</h3>
          </div>
          <div className={classes.statusGrid}>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Total</span>
              <span className={classes.statusCount}>{stats.notes.length}</span>
            </div>
            <div className={classes.statusItem}>
              <span className={classes.statusLabel}>Shared with agents</span>
              <span className={classes.statusCount}>{notesInContext}</span>
            </div>
          </div>
        </div>

        {/* Memories */}
        <div className={classes.section}>
          <div className={classes.sectionHeader}>
            <Brain size={12} className={classes.sectionIcon} />
            <h3 className={classes.sectionTitle}>Memory</h3>
          </div>
          <div className={classes.memoryBar}>
            <div className={classes.memoryBarRow}>
              <span className={classes.memoryBarLabel}>Memories</span>
              <span className={classes.memoryBarValue}>{stats.memories.length}</span>
            </div>
            <div className={classes.memoryBarRow}>
              <span className={classes.memoryBarLabel}>Summarized</span>
              <span className={classes.memoryBarValue}>
                {stats.memories.filter((m) => m.consolidated).length}
              </span>
            </div>
            <div className={classes.memoryBarRow}>
              <span className={classes.memoryBarLabel}>Memory summaries</span>
              <span className={classes.memoryBarValue}>{stats.consolidations.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
