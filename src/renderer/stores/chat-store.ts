import { create } from 'zustand';
import { useSessionStore } from './session-store';

interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface StreamChunk {
  type: 'text' | 'thinking' | 'error' | 'done' | 'tool_use' | 'tool_result';
  content: string;
  toolUse?: ToolUse;
}

interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
}

interface ChatState {
  isLoading: boolean;
  streamingContent: string;
  toolApprovalRequest: ToolApprovalRequest | null;

  sendMessage: (message: string) => Promise<void>;
  cancelStream: () => Promise<void>;
  clearHistory: () => Promise<void>;
  setToolApprovalRequest: (request: ToolApprovalRequest | null) => void;
  respondToolApproval: (approved: boolean) => void;
  initStreamListener: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isLoading: false,
  streamingContent: '',
  toolApprovalRequest: null,

  sendMessage: async (message: string) => {
    const { apiKey } = window.electronAPI ? await window.electronAPI.configLoad() : { apiKey: '' };
    if (!apiKey) {
      console.error('API Key not configured');
      return;
    }

    set({ isLoading: true, streamingContent: '' });

    try {
      await window.electronAPI.sendMessageStream(message);
    } catch (error) {
      console.error('Send message error:', error);
      set({ isLoading: false });
    }
  },

  cancelStream: async () => {
    await window.electronAPI.abortStream();
    set({ isLoading: false, streamingContent: '' });
  },

  clearHistory: async () => {
    await window.electronAPI.clearHistory();
    useSessionStore.getState().setCurrentMessages([]);
    await useSessionStore.getState().refreshSessions();
  },

  setToolApprovalRequest: (request) => set({ toolApprovalRequest: request }),

  respondToolApproval: (approved) => {
    window.electronAPI.respondToolApproval(approved);
    set({ toolApprovalRequest: null });
  },

  initStreamListener: () => {
    window.electronAPI.onStreamChunk((chunk: StreamChunk) => {
      const { streamingContent } = get();

      if (chunk.type === 'done') {
        set({ isLoading: false, streamingContent: '' });
        useSessionStore.getState().refreshSessions();
        return;
      }

      if (chunk.type === 'text') {
        set({ streamingContent: streamingContent + chunk.content });
      } else if (chunk.type === 'error') {
        console.error('Stream error:', chunk.content);
        set({ isLoading: false });
      }
    });

    window.electronAPI.onToolApprovalRequest((request: ToolApprovalRequest) => {
      set({ toolApprovalRequest: request });
    });
  },
}));
