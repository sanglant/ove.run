import { create } from "zustand";
import type { AgentSession, AgentStatus } from "@/types";

interface SessionState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  addSession: (session: AgentSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (id: string, status: AgentStatus) => void;
  updateSessionYolo: (id: string, yoloMode: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session: AgentSession) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
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
}));
