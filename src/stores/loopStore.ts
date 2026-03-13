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

export interface ReasoningEntry {
  action: string;
  reasoning: string;
  timestamp: string;
}

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
    }
  },

  loadQualityGates: async (projectId) => {
    try {
      const config = await getQualityGates(projectId);
      set({ qualityGates: config });
    } catch (err) {
      console.error("Failed to load quality gates:", err);
    }
  },

  saveQualityGates: async (projectId, config) => {
    try {
      await apiSetQualityGates(projectId, config);
      set({ qualityGates: config });
    } catch (err) {
      console.error("Failed to save quality gates:", err);
    }
  },

  startLoop: async (projectId, projectPath, request) => {
    try {
      await apiStartLoop(projectId, projectPath, request);
      set({ status: "running" });
    } catch (err) {
      console.error("Failed to start loop:", err);
    }
  },

  pauseLoop: async () => {
    try {
      await apiPauseLoop();
      set({ status: "paused" });
    } catch (err) {
      console.error("Failed to pause loop:", err);
    }
  },

  resumeLoop: async () => {
    try {
      await apiResumeLoop();
      set({ status: "running" });
    } catch (err) {
      console.error("Failed to resume loop:", err);
    }
  },

  cancelLoop: async () => {
    try {
      await apiCancelLoop();
      set({ status: "idle" });
    } catch (err) {
      console.error("Failed to cancel loop:", err);
    }
  },

  handleEvent: (event) => {
    const { stories } = get();
    switch (event.type) {
      case "StatusChanged":
        set({ status: event.status });
        break;
      case "StoryStarted":
        set({
          stories: stories.map((s) =>
            s.id === event.story_id ? { ...s, status: "in_progress" } : s,
          ),
        });
        break;
      case "StoryCompleted":
        set({
          stories: stories.map((s) =>
            s.id === event.story_id ? { ...s, status: "completed" } : s,
          ),
        });
        break;
      case "StoryFailed":
        set({
          stories: stories.map((s) =>
            s.id === event.story_id ? { ...s, status: "failed" } : s,
          ),
        });
        break;
      case "IterationCompleted":
        set({ iterationCount: event.count, maxIterations: event.max });
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
        }));
        break;
      case "CircuitBreakerTriggered":
        set({ status: "paused" });
        break;
      case "LoopCompleted":
        set({ status: "completed" });
        break;
      case "LoopFailed":
        set({ status: "failed" });
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
