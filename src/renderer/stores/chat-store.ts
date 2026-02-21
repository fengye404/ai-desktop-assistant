import { create } from 'zustand';
import { useSessionStore, type ChatMessage } from './session-store';
import { useConfigStore } from './config-store';
import type { ToolCallRecord, MessageItem } from '../../types';

// Re-export for ToolCallBlock component
export type ToolCall = ToolCallRecord;

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

// 流式内容块类型 - 与 MessageItem 兼容
export type StreamItem = MessageItem;

interface ChatState {
  isLoading: boolean;
  streamItems: StreamItem[];  // 按顺序存储文字和工具调用
  pendingApprovalId: string | null;

  sendMessage: (message: string) => Promise<void>;
  cancelStream: () => Promise<void>;
  clearHistory: () => Promise<void>;
  approveToolCall: (id: string) => void;
  rejectToolCall: (id: string) => void;
  initStreamListener: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isLoading: false,
  streamItems: [],
  pendingApprovalId: null,

  sendMessage: async (message: string) => {
    // 立即显示用户消息
    const sessionStore = useSessionStore.getState();
    const currentMessages = sessionStore.currentMessages;
    sessionStore.setCurrentMessages([
      ...currentMessages,
      { role: 'user', content: message, timestamp: Date.now() }
    ]);

    set({ isLoading: true, streamItems: [] });

    try {
      await window.electronAPI.sendMessageStream(message);
    } catch (error) {
      console.error('[chat-store] Send message error:', error);
      set({ isLoading: false, streamItems: [] });
    }
  },

  cancelStream: async () => {
    await window.electronAPI.abortStream();
    set({ isLoading: false, streamItems: [] });
  },

  clearHistory: async () => {
    await window.electronAPI.clearHistory();
    useSessionStore.getState().setCurrentMessages([]);
    set({ streamItems: [] });
    await useSessionStore.getState().refreshSessions();
  },

  approveToolCall: (id: string) => {
    // 更新工具状态为 running
    set((state) => {
      const updatedItems = state.streamItems.map(item => {
        if (item.type === 'tool' && item.toolCall.id === id) {
          return { ...item, toolCall: { ...item.toolCall, status: 'running' as const } };
        }
        return item;
      });
      return { streamItems: updatedItems, pendingApprovalId: null };
    });
    // 通知主进程继续执行
    window.electronAPI.respondToolApproval(true);
  },

  rejectToolCall: (id: string) => {
    // 更新工具状态为 error
    set((state) => {
      const updatedItems = state.streamItems.map(item => {
        if (item.type === 'tool' && item.toolCall.id === id) {
          return { 
            ...item, 
            toolCall: { ...item.toolCall, status: 'error' as const, error: '用户拒绝执行' } 
          };
        }
        return item;
      });
      return { streamItems: updatedItems, pendingApprovalId: null };
    });
    // 通知主进程拒绝
    window.electronAPI.respondToolApproval(false);
  },

  initStreamListener: () => {
    window.electronAPI.onStreamChunk((chunk: StreamChunk) => {
      if (chunk.type === 'done') {
        const sessionStore = useSessionStore.getState();
        const { streamItems } = get();
        
        // 合并文字内容用于 content 字段（兼容旧版本）
        const textContent = streamItems
          .filter((item): item is { type: 'text'; content: string } => item.type === 'text')
          .map(item => item.content)
          .join('');
        
        // 创建包含 items 的消息并持久化
        if (streamItems.length > 0) {
          const currentMessages = sessionStore.currentMessages;
          sessionStore.setCurrentMessages([
            ...currentMessages,
            { 
              role: 'assistant', 
              content: textContent,
              items: streamItems,  // 保存完整的 items 用于渲染
              timestamp: Date.now() 
            }
          ]);
        }
        
        // 清空 streamItems，数据已持久化到 currentMessages
        set({ isLoading: false, streamItems: [] });
        
        // 后台刷新确保数据一致性
        sessionStore.refreshSessions();
        return;
      }

      if (chunk.type === 'text') {
        // 追加文字到最后一个 text 块，或创建新的 text 块
        set((state) => {
          const items = [...state.streamItems];
          const lastItem = items[items.length - 1];
          
          if (lastItem && lastItem.type === 'text') {
            // 追加到已有的 text 块
            items[items.length - 1] = { type: 'text', content: lastItem.content + chunk.content };
          } else {
            // 创建新的 text 块
            items.push({ type: 'text', content: chunk.content });
          }
          
          return { streamItems: items };
        });
      } else if (chunk.type === 'tool_use' && chunk.toolUse) {
        // 创建新的工具调用块
        const newToolCall: ToolCall = {
          id: chunk.toolUse.id,
          name: chunk.toolUse.name,
          input: chunk.toolUse.input,
          status: 'running',
        };
        set((state) => ({
          streamItems: [...state.streamItems, { type: 'tool', toolCall: newToolCall }]
        }));
      } else if (chunk.type === 'tool_result') {
        // 更新对应的工具调用状态
        const isError = chunk.content.includes('failed');
        set((state) => {
          const items = [...state.streamItems];
          // 从后往前找到最后一个 running 状态的工具
          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.type === 'tool' && item.toolCall.status === 'running') {
              items[i] = {
                type: 'tool',
                toolCall: {
                  ...item.toolCall,
                  status: isError ? 'error' : 'success',
                  output: isError ? undefined : chunk.content,
                  error: isError ? chunk.content : undefined,
                }
              };
              break;
            }
          }
          return { streamItems: items };
        });
      } else if (chunk.type === 'error') {
        console.error('[chat-store] Stream error:', chunk.content);
        const sessionStore = useSessionStore.getState();
        const currentMessages = sessionStore.currentMessages;
        sessionStore.setCurrentMessages([
          ...currentMessages,
          { role: 'assistant', content: `❌ ${chunk.content}`, timestamp: Date.now() }
        ]);
        set({ isLoading: false, streamItems: [] });
      }
    });

    window.electronAPI.onToolApprovalRequest((request: ToolApprovalRequest) => {
      const isAllowed = useConfigStore.getState().isToolAllowed(request.tool);
      
      if (isAllowed) {
        window.electronAPI.respondToolApproval(true);
      } else {
        // 找到对应的工具调用并设置为 pending
        set((state) => {
          const items = state.streamItems.map(item => {
            if (item.type === 'tool' && 
                item.toolCall.name === request.tool && 
                item.toolCall.status === 'running') {
              return { 
                ...item, 
                toolCall: { ...item.toolCall, status: 'pending' as const } 
              };
            }
            return item;
          });
          
          // 找到 pending 的工具 ID
          const pendingItem = items.find(
            (item): item is { type: 'tool'; toolCall: ToolCall } => 
              item.type === 'tool' && item.toolCall.status === 'pending'
          );
          
          return { 
            streamItems: items, 
            pendingApprovalId: pendingItem?.toolCall.id || null 
          };
        });
      }
    });
  },
}));
