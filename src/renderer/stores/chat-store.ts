import { create } from 'zustand';
import { electronApiClient } from '@/services/electron-api-client';
import { useConfigStore } from './config-store';
import { useSessionStore } from './session-store';
import type { MessageItem, ToolCallRecord } from '../../types';
import { createChatStreamListener, type ChatStreamListener } from './chat-stream-listener';
import {
  applyApproveToolCallToStreamState,
  applyRejectToolCallToStreamState,
  getInitialChatStreamState,
  getTextContentFromStreamItems,
  type ChatStreamState,
} from './chat-stream-state';

export type ToolCall = ToolCallRecord;
export type StreamItem = MessageItem;

interface ChatState {
  isLoading: boolean;
  streamItems: StreamItem[];
  pendingApprovalId: string | null;
  isWaitingResponse: boolean;

  sendMessage: (message: string) => Promise<void>;
  cancelStream: () => Promise<void>;
  clearHistory: () => Promise<void>;
  approveToolCall: (id: string) => void;
  rejectToolCall: (id: string) => void;
  initStreamListener: () => void;
}

type StreamStateSlice = Pick<ChatState, 'streamItems' | 'pendingApprovalId' | 'isWaitingResponse'>;

function createEmptyStreamState(): StreamStateSlice {
  const initial = getInitialChatStreamState();
  return {
    streamItems: initial.streamItems,
    pendingApprovalId: initial.pendingApprovalId,
    isWaitingResponse: initial.isWaitingResponse,
  };
}

function pickStreamState(state: ChatState): ChatStreamState {
  return {
    streamItems: state.streamItems,
    pendingApprovalId: state.pendingApprovalId,
    isWaitingResponse: state.isWaitingResponse,
  };
}

function toStreamStateSlice(next: ChatStreamState): StreamStateSlice {
  return {
    streamItems: next.streamItems,
    pendingApprovalId: next.pendingApprovalId,
    isWaitingResponse: next.isWaitingResponse,
  };
}

export const useChatStore = create<ChatState>((set, get) => {
  let streamListener: ChatStreamListener | null = null;

  const updateStreamState = (updater: (state: ChatStreamState) => ChatStreamState) => {
    set((state) => toStreamStateSlice(updater(pickStreamState(state))));
  };

  const getStreamState = (): ChatStreamState => {
    return pickStreamState(get());
  };

  return {
    isLoading: false,
    ...createEmptyStreamState(),

    sendMessage: async (message: string) => {
      const sessionStore = useSessionStore.getState();
      const currentMessages = sessionStore.currentMessages;
      sessionStore.setCurrentMessages([
        ...currentMessages,
        { role: 'user', content: message, timestamp: Date.now() },
      ]);

      set({ isLoading: true, ...createEmptyStreamState() });

      try {
        await electronApiClient.sendMessageStream(message);
      } catch (error) {
        console.error('[chat-store] Send message error:', error);
        set({ isLoading: false, ...createEmptyStreamState() });
      }
    },

    cancelStream: async () => {
      await electronApiClient.abortStream();
      streamListener?.dispose();
      set({ isLoading: false, ...createEmptyStreamState() });
    },

    clearHistory: async () => {
      await electronApiClient.clearHistory();
      useSessionStore.getState().setCurrentMessages([]);
      streamListener?.dispose();
      set(createEmptyStreamState());
      await useSessionStore.getState().refreshSessions();
    },

    approveToolCall: (id: string) => {
      updateStreamState((state) => applyApproveToolCallToStreamState(state, id));
      electronApiClient.respondToolApproval(true);
    },

    rejectToolCall: (id: string) => {
      updateStreamState((state) => applyRejectToolCallToStreamState(state, id));
      electronApiClient.respondToolApproval(false);
    },

    initStreamListener: () => {
      streamListener?.dispose();
      streamListener = createChatStreamListener({
        getState: getStreamState,
        updateState: updateStreamState,
        onDone: (streamItems) => {
          const sessionStore = useSessionStore.getState();
          const textContent = getTextContentFromStreamItems(streamItems);

          if (streamItems.length > 0) {
            const currentMessages = sessionStore.currentMessages;
            sessionStore.setCurrentMessages([
              ...currentMessages,
              {
                role: 'assistant',
                content: textContent,
                items: streamItems,
                timestamp: Date.now(),
              },
            ]);
          }

          set({ isLoading: false, ...createEmptyStreamState() });
          void sessionStore.refreshSessions();
        },
        onError: (message) => {
          console.error('[chat-store] Stream error:', message);
          const sessionStore = useSessionStore.getState();
          const currentMessages = sessionStore.currentMessages;
          sessionStore.setCurrentMessages([
            ...currentMessages,
            { role: 'assistant', content: `❌ ${message}`, timestamp: Date.now() },
          ]);
          set({ isLoading: false, ...createEmptyStreamState() });
        },
        isToolAllowed: (tool) => useConfigStore.getState().isToolAllowed(tool),
        respondToolApproval: (approved) => electronApiClient.respondToolApproval(approved),
      });

      electronApiClient.onStreamChunk(streamListener.handleChunk);
      electronApiClient.onToolApprovalRequest(streamListener.handleToolApprovalRequest);
    },
  };
});
