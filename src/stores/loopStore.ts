import { create } from "zustand";
import type { Story, LoopStatus, GateResult, LoopEventType, ArbiterState, QualityGateConfig } from "@/types";
import {
  getLoopState,
  startLoop as apiStartLoop,
  pauseLoop as apiPauseLoop,
  resumeLoop as apiResumeLoop,
  cancelLoop as apiCancelLoop,
  getQualityGates,
  setQualityGates as apiSetQualityGates,
  listen,
} from "@/lib/tauri";
import { useNotificationStore } from "./notificationStore";

export interface ReasoningEntry {
  action: string;
  reasoning: string;
  timestamp: string;
}

/** Phases the loop walks through for each story */
export type LoopPhase = "idle" | "planning" | "agent" | "gates" | "judging" | "done";

interface LoopStoreState {
  status: LoopStatus;
  stories: Story[];
  arbiterState: ArbiterState | null;
  gateResults: Record<string, GateResult[]>;
  reasoningLog: ReasoningEntry[];
  iterationCount: number;
  maxIterations: number;
  qualityGates: QualityGateConfig | null;
  loading: boolean;
  /** Human-readable description of what the loop is currently doing */
  activityMessage: string | null;
  /** Current high-level phase */
  phase: LoopPhase;
  /** Session ID of the active loop PTY (for console preview) */
  activeSessionId: string | null;

  loadState: (projectId: string) => Promise<void>;
  loadQualityGates: (projectId: string) => Promise<void>;
  saveQualityGates: (projectId: string, config: QualityGateConfig) => Promise<void>;
  startLoop: (projectId: string, projectPath: string, request?: string) => Promise<void>;
  pauseLoop: () => Promise<void>;
  resumeLoop: () => Promise<void>;
  cancelLoop: () => Promise<void>;
  handleEvent: (event: LoopEventType) => void;
}

export const useLoopStore = create<LoopStoreState>((set, get) => ({
  status: "idle",
  stories: [],
  arbiterState: null,
  gateResults: {},
  reasoningLog: [],
  iterationCount: 0,
  maxIterations: 10,
  qualityGates: null,
  loading: false,
  activityMessage: null,
  phase: "idle",
  activeSessionId: null,

  loadState: async (projectId) => {
    set({ loading: true });
    try {
      const state = await getLoopState(projectId);
      set({
        arbiterState: state.arbiter_state,
        stories: state.stories,
        status: state.arbiter_state?.loop_status ?? "idle",
        iterationCount: state.arbiter_state?.iteration_count ?? 0,
        maxIterations: state.arbiter_state?.max_iterations ?? 10,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load loop state:", err);
      set({ loading: false });
      useNotificationStore.getState().showToast("error", "Failed to load loop state", String(err));
    }
  },

  loadQualityGates: async (projectId) => {
    try {
      const config = await getQualityGates(projectId);
      set({ qualityGates: config });
    } catch (err) {
      console.error("Failed to load quality gates:", err);
      useNotificationStore.getState().showToast("error", "Failed to load quality gates", String(err));
    }
  },

  saveQualityGates: async (projectId, config) => {
    try {
      await apiSetQualityGates(projectId, config);
      set({ qualityGates: config });
    } catch (err) {
      console.error("Failed to save quality gates:", err);
      useNotificationStore.getState().showToast("error", "Failed to save quality gates", String(err));
    }
  },

  startLoop: async (projectId, projectPath, request) => {
    try {
      // Clear previous run data; status will be updated via backend events
      set({ stories: [], reasoningLog: [], gateResults: {}, activityMessage: "Starting loop…", phase: "planning", activeSessionId: null });
      await apiStartLoop(projectId, projectPath, request);
    } catch (err) {
      console.error("Failed to start loop:", err);
      set({ status: "idle", activityMessage: null, phase: "idle" });
      useNotificationStore.getState().showToast("error", "Failed to start loop", String(err));
    }
  },

  pauseLoop: async () => {
    try {
      await apiPauseLoop();
      set({ status: "paused" });
    } catch (err) {
      console.error("Failed to pause loop:", err);
      useNotificationStore.getState().showToast("error", "Failed to pause loop", String(err));
    }
  },

  resumeLoop: async () => {
    try {
      await apiResumeLoop();
      set({ status: "running" });
    } catch (err) {
      console.error("Failed to resume loop:", err);
      useNotificationStore.getState().showToast("error", "Failed to resume loop", String(err));
    }
  },

  cancelLoop: async () => {
    try {
      await apiCancelLoop();
      set({ status: "idle", activityMessage: null, phase: "idle", activeSessionId: null });
    } catch (err) {
      console.error("Failed to cancel loop:", err);
      useNotificationStore.getState().showToast("error", "Failed to cancel loop", String(err));
    }
  },

  handleEvent: (event) => {
    switch (event.type) {
      case "StatusChanged": {
        const statusMessages: Record<string, string> = {
          planning: "Decomposing request into stories…",
          running: "Executing stories…",
          paused: "Loop paused",
          idle: "Loop idle",
        };
        const phaseMap: Record<string, LoopPhase> = {
          planning: "planning",
          running: "agent",
          paused: "idle",
          idle: "idle",
          completed: "done",
          failed: "done",
        };
        set({
          status: event.status,
          activityMessage: statusMessages[event.status] ?? null,
          phase: phaseMap[event.status] ?? "idle",
        });
        break;
      }
      case "StoriesUpdated": {
        // Reload full state from DB to pick up newly created stories
        void get().loadState(event.project_id);
        set({ activityMessage: "Stories created, starting execution…" });
        break;
      }
      case "StoryStarted": {
        // Use functional update to always read latest stories (avoids stale closure)
        set((state) => {
          const story = state.stories.find((s) => s.id === event.story_id);
          const projectId = story?.project_id ?? state.arbiterState?.project_id;
          const sessionId = projectId ? `loop-${projectId}-${event.story_id}` : null;
          return {
            stories: state.stories.map((s) =>
              s.id === event.story_id ? { ...s, status: "in_progress" as const } : s,
            ),
            activityMessage: story ? `Working on: ${story.title}` : "Starting story…",
            phase: "agent" as const,
            activeSessionId: sessionId,
          };
        });
        break;
      }
      case "StoryCompleted": {
        set((state) => {
          const story = state.stories.find((s) => s.id === event.story_id);
          return {
            stories: state.stories.map((s) =>
              s.id === event.story_id ? { ...s, status: "completed" as const } : s,
            ),
            activityMessage: story ? `Completed: ${story.title}` : "Story completed",
            activeSessionId: null,
          };
        });
        break;
      }
      case "StoryFailed": {
        set((state) => {
          const story = state.stories.find((s) => s.id === event.story_id);
          return {
            stories: state.stories.map((s) =>
              s.id === event.story_id ? { ...s, status: "failed" as const } : s,
            ),
            activityMessage: story ? `Failed: ${story.title} — ${event.reason}` : `Story failed: ${event.reason}`,
            activeSessionId: null,
          };
        });
        break;
      }
      case "IterationCompleted":
        set({
          iterationCount: event.count,
          maxIterations: event.max,
          activityMessage: `Iteration ${event.count} of ${event.max} completed`,
        });
        break;
      case "GateResult":
        set((state) => ({
          gateResults: {
            ...state.gateResults,
            [event.story_id]: [
              ...(state.gateResults[event.story_id] ?? []),
              { name: event.gate, passed: event.passed, output: event.output },
            ],
          },
          activityMessage: `Gate "${event.gate}" ${event.passed ? "passed" : "failed"}`,
          phase: "gates" as const,
        }));
        break;
      case "CircuitBreakerTriggered":
        set({ status: "paused", activityMessage: `Circuit breaker: ${event.reason}` });
        break;
      case "LoopCompleted":
        set({ status: "completed", activityMessage: "All stories completed", phase: "done", activeSessionId: null });
        break;
      case "LoopFailed":
        set({ status: "failed", activityMessage: `Loop failed: ${event.reason}`, phase: "done", activeSessionId: null });
        break;
      case "ReasoningEntry":
        set((state) => ({
          reasoningLog: [
            ...state.reasoningLog,
            {
              action: event.action,
              reasoning: event.reasoning,
              timestamp: new Date().toISOString(),
            },
          ],
          activityMessage: `Arbiter: ${event.action}`,
          phase: event.action === "JudgeCompletion" ? "judging" as const : state.phase,
        }));
        break;
    }
  },
}));

export function initLoopListener(): () => void {
  let unlisten: (() => void) | null = null;

  listen<LoopEventType>("loop-event", (tauriEvent) => {
    useLoopStore.getState().handleEvent(tauriEvent.payload);
  })
    .then((fn) => {
      unlisten = fn;
    })
    .catch((err) => {
      console.error("Failed to subscribe to loop events:", err);
    });

  return () => {
    if (unlisten) unlisten();
  };
}
