import { useEffect, useState } from "react";
import { RotateCw, ChevronDown, ChevronRight, Settings2, Play } from "lucide-react";
import { Button, Switch, TextInput } from "@mantine/core";
import { useProjectStore } from "@/stores/projectStore";
import { useLoopStore } from "@/stores/loopStore";
import type { QualityGateConfig } from "@/types";
import { StoryList } from "./StoryList";
import { LoopControls } from "./LoopControls";
import { LoopProgress } from "./LoopProgress";
import { ArbiterReasoningLog } from "./ArbiterReasoningLog";
import { LoopConsolePreview } from "./LoopConsolePreview";
import classes from "./LoopPanel.module.css";

const DEFAULT_GATES: QualityGateConfig = {
  build_command: null,
  lint_command: null,
  typecheck_command: null,
  test_command: null,
  arbiter_judge: true,
};

export function LoopPanel() {
  const { activeProjectId, projects } = useProjectStore();
  const {
    status,
    stories,
    arbiterState,
    reasoningLog,
    iterationCount,
    maxIterations,
    qualityGates,
    loading,
    activityMessage,
    phase,
    activeSessionId,
    loadState,
    loadQualityGates,
    saveQualityGates,
    startLoop,
    pauseLoop,
    resumeLoop,
    cancelLoop,
  } = useLoopStore();

  const [gatesOpen, setGatesOpen] = useState(false);
  const [draftGates, setDraftGates] = useState<QualityGateConfig>(DEFAULT_GATES);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!activeProjectId) return;
    void loadState(activeProjectId);
    void loadQualityGates(activeProjectId);
  }, [activeProjectId, loadState, loadQualityGates]);

  useEffect(() => {
    if (qualityGates) {
      setDraftGates(qualityGates);
    }
  }, [qualityGates]);

  const handleSaveGates = () => {
    if (!activeProjectId) return;
    void saveQualityGates(activeProjectId, draftGates);
  };

  if (!activeProjectId || !activeProject) {
    return (
      <div className={classes.emptyState}>
        <RotateCw size={42} strokeWidth={1} className={classes.emptyIcon} />
        <p>Select a project to use the Loop Engine.</p>
      </div>
    );
  }

  const isIdle = status === "idle" && stories.length === 0 && !activityMessage;

  return (
    <div className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <div className={classes.headerTitle}>
          <RotateCw size={15} className={classes.headerIcon} />
          <h2 className={classes.title}>Loop</h2>
        </div>
        <LoopControls
          status={status}
          projectId={activeProjectId}
          projectPath={activeProject.path}
          onStart={startLoop}
          onPause={pauseLoop}
          onResume={resumeLoop}
          onCancel={cancelLoop}
        />
      </div>

      {/* Body */}
      <div className={classes.body}>
        {isIdle ? (
          <div className={classes.idleState}>
            <div className={classes.idleIcon}>
              <Play size={20} />
            </div>
            <p className={classes.idleTitle}>Ready to loop</p>
            <p className={classes.idleDescription}>
              Press <strong>Start</strong> and describe what you want to build. The loop engine will decompose your request into stories and iterate through them autonomously.
            </p>
          </div>
        ) : (
          <>
            {/* Progress */}
            <LoopProgress
              status={status}
              iterationCount={iterationCount}
              maxIterations={maxIterations}
              currentStoryId={arbiterState?.current_story_id ?? null}
              stories={stories}
              activityMessage={activityMessage}
              phase={phase}
            />

            {/* Console preview — live PTY output from the active agent */}
            <LoopConsolePreview sessionId={activeSessionId} />

            {/* Two-column layout */}
            <div className={classes.columns}>
              {/* Stories column */}
              <div className={classes.column}>
                <div className={classes.columnHeader}>
                  <span className={classes.columnTitle}>Stories</span>
                  {loading && <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>loading…</span>}
                </div>
                <div className={classes.columnScroll}>
                  <StoryList stories={stories} />
                </div>
              </div>

              {/* Reasoning log column */}
              <div className={classes.column}>
                <div className={classes.columnHeader}>
                  <span className={classes.columnTitle}>Reasoning Log</span>
                </div>
                <div className={classes.columnScroll}>
                  <ArbiterReasoningLog entries={reasoningLog} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quality gates section */}
        <div className={classes.gatesSection}>
          <button
            className={classes.gatesToggle}
            onClick={() => setGatesOpen((v) => !v)}
            aria-expanded={gatesOpen}
          >
            <Settings2 size={12} />
            Quality Gates
            {gatesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {gatesOpen && (
            <div className={classes.gatesBody}>
              <div className={classes.gatesGrid}>
                <TextInput
                  label="Build command"
                  placeholder="npm run build"
                  value={draftGates.build_command ?? ""}
                  onChange={(e) =>
                    setDraftGates((g) => ({ ...g, build_command: e.target.value || null }))
                  }
                  size="xs"
                  styles={{
                    label: { fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
                    input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", fontSize: 11 },
                  }}
                />
                <TextInput
                  label="Lint command"
                  placeholder="npm run lint"
                  value={draftGates.lint_command ?? ""}
                  onChange={(e) =>
                    setDraftGates((g) => ({ ...g, lint_command: e.target.value || null }))
                  }
                  size="xs"
                  styles={{
                    label: { fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
                    input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", fontSize: 11 },
                  }}
                />
                <TextInput
                  label="Typecheck command"
                  placeholder="npm run typecheck"
                  value={draftGates.typecheck_command ?? ""}
                  onChange={(e) =>
                    setDraftGates((g) => ({ ...g, typecheck_command: e.target.value || null }))
                  }
                  size="xs"
                  styles={{
                    label: { fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
                    input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", fontSize: 11 },
                  }}
                />
                <TextInput
                  label="Test command"
                  placeholder="npm test"
                  value={draftGates.test_command ?? ""}
                  onChange={(e) =>
                    setDraftGates((g) => ({ ...g, test_command: e.target.value || null }))
                  }
                  size="xs"
                  styles={{
                    label: { fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
                    input: { backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)", fontSize: 11 },
                  }}
                />
              </div>

              <div className={classes.gatesFooter}>
                <Switch
                  label="Arbiter judge"
                  checked={draftGates.arbiter_judge}
                  onChange={(e) =>
                    setDraftGates((g) => ({ ...g, arbiter_judge: e.target.checked }))
                  }
                  size="xs"
                  styles={{
                    label: { fontSize: 11, color: "var(--text-secondary)" },
                  }}
                />
                <Button
                  size="xs"
                  variant="light"
                  color="var(--accent)"
                  onClick={handleSaveGates}
                  styles={{ root: { fontSize: 11, height: 26, minHeight: 26 } }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
