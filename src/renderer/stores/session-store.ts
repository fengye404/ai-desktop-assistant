import { create } from 'zustand';
import type { ChatMessage, SessionMeta } from '../../types';
import { electronApiClient } from '@/services/electron-api-client';
import { useChatStore } from './chat-store';

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
      const sessions = await electronApiClient.sessionList();
      set({ sessions });

      if (sessions.length > 0 && !get().currentSessionId) {
        const session = await electronApiClient.sessionSwitch(sessions[0].id);
        if (!session) return;

        set({
          currentSessionId: session.id,
          currentMessages: session.messages,
        });
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  },

  createSession: async () => {
    try {
      await electronApiClient.abortStream();
      useChatStore.getState().resetStreamState();

      const session = await electronApiClient.sessionCreate();
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
      await electronApiClient.abortStream();
      useChatStore.getState().resetStreamState();

      const session = await electronApiClient.sessionSwitch(id);
      if (!session) return;

      set({
        currentSessionId: session.id,
        currentMessages: session.messages,
      });
      await get().refreshSessions();
    } catch (error) {
      console.error('Failed to switch session:', error);
    }
  },

  deleteSession: async (id: string) => {
    try {
      await electronApiClient.sessionDelete(id);

      if (id === get().currentSessionId) {
        const sessions = await electronApiClient.sessionList();
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
      await electronApiClient.sessionRename(id, title);
      await get().refreshSessions();
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  },

  setCurrentMessages: (messages) => set({ currentMessages: messages }),

  refreshSessions: async () => {
    try {
      const sessions = await electronApiClient.sessionList();
      set({ sessions });
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  },
}));
