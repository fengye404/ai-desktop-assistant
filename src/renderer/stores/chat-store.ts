import { create } from 'zustand';
import { useSessionStore } from './session-store';
import type { ToolCall } from '../components/ToolCallBlock';

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
  toolCalls: ToolCall[];
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
  toolCalls: [],
  toolApprovalRequest: null,

  sendMessage: async (message: string) => {
    // 立即显示用户消息
    const sessionStore = useSessionStore.getState();
    const currentMessages = sessionStore.currentMessages;
    sessionStore.setCurrentMessages([
      ...currentMessages,
      { role: 'user', content: message, timestamp: Date.now() }
    ]);

    set({ isLoading: true, streamingContent: '', toolCalls: [] });

    try {
      await window.electronAPI.sendMessageStream(message);
    } catch (error) {
      console.error('[chat-store] Send message error:', error);
      set({ isLoading: false, streamingContent: '', toolCalls: [] });
    }
  },

  cancelStream: async () => {
    await window.electronAPI.abortStream();
    set({ isLoading: false, streamingContent: '', toolCalls: [] });
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
      if (chunk.type === 'done') {
        const sessionStore = useSessionStore.getState();
        const { streamingContent } = get();
        
        // 先将流式内容添加到消息列表，避免闪烁
        if (streamingContent) {
          const currentMessages = sessionStore.currentMessages;
          sessionStore.setCurrentMessages([
            ...currentMessages,
            { role: 'assistant', content: streamingContent, timestamp: Date.now() }
          ]);
        }
        
        // 清空状态
        set({ isLoading: false, streamingContent: '', toolCalls: [] });
        
        // 后台刷新确保数据一致性
        sessionStore.refreshSessions();
        return;
      }

      if (chunk.type === 'text') {
        // 每次都获取最新的 streamingContent
        set((state) => ({ streamingContent: state.streamingContent + chunk.content }));
      } else if (chunk.type === 'tool_use' && chunk.toolUse) {
        // 工具开始调用
        const newToolCall: ToolCall = {
          id: chunk.toolUse.id,
          name: chunk.toolUse.name,
          input: chunk.toolUse.input,
          status: 'running',
        };
        set((state) => ({ toolCalls: [...state.toolCalls, newToolCall] }));
      } else if (chunk.type === 'tool_result') {
        // 工具执行完成，更新状态
        const isError = chunk.content.includes('failed');
        set((state) => {
          const updatedToolCalls = [...state.toolCalls];
          // 更新最后一个 running 状态的工具
          for (let i = updatedToolCalls.length - 1; i >= 0; i--) {
            if (updatedToolCalls[i].status === 'running') {
              updatedToolCalls[i] = {
                ...updatedToolCalls[i],
                status: isError ? 'error' : 'success',
                output: isError ? undefined : chunk.content,
                error: isError ? chunk.content : undefined,
              };
              break;
            }
          }
          return { toolCalls: updatedToolCalls };
        });
      } else if (chunk.type === 'error') {
        console.error('[chat-store] Stream error:', chunk.content);
        // 显示错误信息给用户
        const sessionStore = useSessionStore.getState();
        const currentMessages = sessionStore.currentMessages;
        sessionStore.setCurrentMessages([
          ...currentMessages,
          { role: 'assistant', content: `❌ ${chunk.content}`, timestamp: Date.now() }
        ]);
        set({ isLoading: false, streamingContent: '', toolCalls: [] });
      }
    });

    window.electronAPI.onToolApprovalRequest((request: ToolApprovalRequest) => {
      set({ toolApprovalRequest: request });
    });
  },
}));
