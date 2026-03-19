import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface McpActivity {
  id: string;
  timestamp: string;
  session_id: string;
  tool_name: string;
  status: string | null;
  task_summary: string | null;
  question: string | null;
  gate_passed: boolean | null;
}

export interface PendingQuestion {
  id: string;
  session_id: string;
  project_id: string;
  question: string;
  options: string[];
  allow_free_input: boolean;
  created_at_ms: number;
}

export interface McpSessionStatus {
  session_id: string;
  status: string;
  task_summary?: string;
  last_update: string;
}

export interface McpServerStatus {
  running: boolean;
  port: number;
}

interface McpState {
  serverStatus: McpServerStatus;
  activities: McpActivity[];
  pendingQuestions: PendingQuestion[];
  sessionStatuses: Record<string, McpSessionStatus>;

  // Actions
  loadServerStatus: () => Promise<void>;
  loadActivities: (sessionId?: string) => Promise<void>;
  loadPendingQuestions: () => Promise<void>;
  answerQuestion: (questionId: string, response: string, optionIndex?: number) => Promise<void>;

  // Event handlers (called internally)
  addActivity: (activity: McpActivity) => void;
  updateSessionStatus: (update: McpSessionStatus) => void;
  addPendingQuestion: (question: PendingQuestion) => void;
  removePendingQuestion: (questionId: string) => void;
}

export const useMcpStore = create<McpState>((set) => ({
  serverStatus: { running: false, port: 0 },
  activities: [],
  pendingQuestions: [],
  sessionStatuses: {},

  loadServerStatus: async () => {
    try {
      const status = await invoke<McpServerStatus>("get_mcp_server_status");
      set({ serverStatus: status });
    } catch {
      // MCP server may not be available
    }
  },

  loadActivities: async (sessionId?: string) => {
    try {
      const activities = await invoke<McpActivity[]>("list_mcp_activities", {
        sessionId: sessionId ?? null,
      });
      set({ activities });
    } catch {
      // ignore
    }
  },

  loadPendingQuestions: async () => {
    try {
      const questions = await invoke<PendingQuestion[]>("list_pending_questions");
      set({ pendingQuestions: questions });
    } catch {
      // ignore
    }
  },

  answerQuestion: async (questionId: string, response: string, optionIndex?: number) => {
    try {
      await invoke("answer_mcp_question", {
        questionId,
        response,
        optionIndex: optionIndex ?? null,
      });
      // Remove from local state
      set((state) => ({
        pendingQuestions: state.pendingQuestions.filter((q) => q.id !== questionId),
      }));
    } catch (e) {
      console.error("[mcp] Failed to answer question:", e);
    }
  },

  addActivity: (activity: McpActivity) => {
    set((state) => {
      const next = [...state.activities, activity];
      // Keep max 200 entries on frontend too
      if (next.length > 200) next.shift();
      return { activities: next };
    });
  },

  updateSessionStatus: (update: McpSessionStatus) => {
    set((state) => ({
      sessionStatuses: {
        ...state.sessionStatuses,
        [update.session_id]: update,
      },
    }));
  },

  addPendingQuestion: (question: PendingQuestion) => {
    set((state) => ({
      pendingQuestions: [...state.pendingQuestions.filter((q) => q.id !== question.id), question],
    }));
  },

  removePendingQuestion: (questionId: string) => {
    set((state) => ({
      pendingQuestions: state.pendingQuestions.filter((q) => q.id !== questionId),
    }));
  },
}));

// Event listener initialization — call once from App.tsx or main.tsx
let unlisteners: UnlistenFn[] = [];

export function initMcpListeners(): () => void {
  // Clean up any existing listeners
  unlisteners.forEach((fn) => fn());
  unlisteners = [];

  let cancelled = false;

  // Listen for MCP activity events
  listen<McpActivity>("mcp-activity", (event) => {
    useMcpStore.getState().addActivity(event.payload);
  })
    .then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisteners.push(fn);
      }
    })
    .catch((err) => {
      console.error("Failed to subscribe to mcp-activity events:", err);
    });

  // Listen for MCP status updates
  listen<{
    session_id: string;
    status: string;
    task_summary?: string;
  }>("mcp-status-update", (event) => {
    useMcpStore.getState().updateSessionStatus({
      session_id: event.payload.session_id,
      status: event.payload.status,
      task_summary: event.payload.task_summary,
      last_update: new Date().toISOString(),
    });
  })
    .then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisteners.push(fn);
      }
    })
    .catch((err) => {
      console.error("Failed to subscribe to mcp-status-update events:", err);
    });

  // Load initial server status
  useMcpStore.getState().loadServerStatus().catch(() => {});

  return () => {
    cancelled = true;
    unlisteners.forEach((fn) => fn());
    unlisteners = [];
  };
}
