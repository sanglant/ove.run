import { create } from "zustand";
import type { AgentSession, AgentStatus, PersistedSession } from "@/types";
import { saveSessions, loadSessions } from "@/lib/tauri";

interface SessionState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  addSession: (session: AgentSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (id: string, status: AgentStatus) => void;
  updateSessionYolo: (id: string, yoloMode: boolean) => void;
  persistSessions: () => void;
  loadPersistedSessions: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session: AgentSession) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
    get().persistSessions();
  },

  removeSession: (id: string) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? sessions.length > 0
            ? sessions[sessions.length - 1].id
            : null
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
    get().persistSessions();
  },

  setActiveSession: (id: string | null) => {
    set({ activeSessionId: id });
  },

  updateSessionStatus: (id: string, status: AgentStatus) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status } : s,
      ),
    }));
  },

  updateSessionYolo: (id: string, yoloMode: boolean) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, yoloMode } : s,
      ),
    }));
  },

  persistSessions: () => {
    const { sessions } = get();
    const persisted: PersistedSession[] = sessions
      .filter((s) => s.status !== "error" && s.status !== "finished")
      .map((s) => ({
        id: s.id,
        project_id: s.projectId,
        agent_type: s.agentType,
        yolo_mode: s.yoloMode,
        label: s.label,
        is_guardian: s.isGuardian,
        created_at: s.createdAt,
      }));
    saveSessions(persisted).catch((err) => {
      console.error("Failed to persist sessions:", err);
    });
  },

  loadPersistedSessions: async () => {
    try {
      const persisted = await loadSessions();
      if (persisted.length === 0) return;

      const resumed: AgentSession[] = persisted.map((p) => ({
        id: p.id,
        projectId: p.project_id,
        agentType: p.agent_type,
        status: "starting" as const,
        yoloMode: p.yolo_mode,
        createdAt: p.created_at,
        label: p.label,
        isGuardian: p.is_guardian,
        isResumed: true,
      }));

      set((state) => ({
        sessions: [...state.sessions, ...resumed],
        activeSessionId: resumed[resumed.length - 1]?.id ?? state.activeSessionId,
      }));
    } catch (err) {
      console.error("Failed to load persisted sessions:", err);
    }
  },
}));
