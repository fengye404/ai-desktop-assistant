import { create } from 'zustand';
import type { MessageItem } from '../../types';

interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  items?: MessageItem[];  // 支持工具调用记录
  timestamp?: number;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionState {
  sessions: SessionMeta[];
  currentSessionId: string | null;
  currentMessages: ChatMessage[];

  loadSessions: () => Promise<void>;
  createSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  setCurrentMessages: (messages: ChatMessage[]) => void;
  refreshSessions: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  currentMessages: [],

  loadSessions: async () => {
    try {
      const sessions = await window.electronAPI.sessionList();
      set({ sessions });

      if (sessions.length > 0 && !get().currentSessionId) {
        const session = await window.electronAPI.sessionSwitch(sessions[0].id);
        if (session) {
          set({
            currentSessionId: session.id,
            currentMessages: session.messages,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  },

  createSession: async () => {
    try {
      const session = await window.electronAPI.sessionCreate();
      set({
        currentSessionId: session.id,
        currentMessages: [],
      });
      await get().refreshSessions();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },

  switchSession: async (id: string) => {
    if (id === get().currentSessionId) return;

    try {
      const session = await window.electronAPI.sessionSwitch(id);
      if (session) {
        set({
          currentSessionId: session.id,
          currentMessages: session.messages,
        });
        await get().refreshSessions();
      }
    } catch (error) {
      console.error('Failed to switch session:', error);
    }
  },

  deleteSession: async (id: string) => {
    try {
      await window.electronAPI.sessionDelete(id);

      if (id === get().currentSessionId) {
        const sessions = await window.electronAPI.sessionList();
        if (sessions.length > 0) {
          await get().switchSession(sessions[0].id);
        } else {
          await get().createSession();
        }
      } else {
        await get().refreshSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  renameSession: async (id: string, title: string) => {
    try {
      await window.electronAPI.sessionRename(id, title);
      await get().refreshSessions();
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  },

  setCurrentMessages: (messages) => set({ currentMessages: messages }),

  refreshSessions: async () => {
    try {
      const sessions = await window.electronAPI.sessionList();
      set({ sessions });
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  },
}));
