import type { MessageItem, StreamChunk, ToolCallRecord } from '../../types';

interface ToolInputBufferEntry {
  name: string;
  accumulated: string;
}

export interface ChatStreamState {
  streamItems: MessageItem[];
  pendingApprovalId: string | null;
  isWaitingResponse: boolean;
}

const DEFAULT_STATE: ChatStreamState = {
  streamItems: [],
  pendingApprovalId: null,
  isWaitingResponse: false,
};

function cloneWithItems(state: ChatStreamState, streamItems: MessageItem[]): ChatStreamState {
  return {
    ...state,
    streamItems,
  };
}

function cloneToolCallWithResult(toolCall: ToolCallRecord, content: string): ToolCallRecord {
  const isError = content.includes('failed');
  return {
    ...toolCall,
    status: isError ? 'error' : 'success',
    output: isError ? undefined : content,
    error: isError ? content : undefined,
    inputStreaming: false,
    inputText: undefined,
  };
}

export function getInitialChatStreamState(): ChatStreamState {
  return {
    streamItems: [],
    pendingApprovalId: DEFAULT_STATE.pendingApprovalId,
    isWaitingResponse: DEFAULT_STATE.isWaitingResponse,
  };
}

export function appendTextToStreamState(state: ChatStreamState, text: string): ChatStreamState {
  if (!text) return state;

  const items = [...state.streamItems];
  const lastItem = items[items.length - 1];

  if (lastItem && lastItem.type === 'text') {
    items[items.length - 1] = { type: 'text', content: lastItem.content + text };
  } else {
    items.push({ type: 'text', content: text });
  }

  return {
    ...cloneWithItems(state, items),
    isWaitingResponse: false,
  };
}

export function applyToolInputBufferUpdates(
  state: ChatStreamState,
  updates: Array<[string, ToolInputBufferEntry]>,
): ChatStreamState {
  if (updates.length === 0) return state;

  const items = [...state.streamItems];

  for (const [toolId, payload] of updates) {
    const existingToolIndex = items.findIndex(
      (item) => item.type === 'tool' && item.toolCall.id === toolId,
    );

    if (existingToolIndex >= 0) {
      const existingItem = items[existingToolIndex];
      if (existingItem.type === 'tool') {
        items[existingToolIndex] = {
          type: 'tool',
          toolCall: {
            ...existingItem.toolCall,
            name: payload.name,
            inputText: payload.accumulated,
            inputStreaming: true,
          },
        };
      }
    } else {
      items.push({
        type: 'tool',
        toolCall: {
          id: toolId,
          name: payload.name,
          input: {},
          status: 'running' as const,
          inputText: payload.accumulated,
          inputStreaming: true,
        },
      });
    }
  }

  return {
    ...cloneWithItems(state, items),
    isWaitingResponse: false,
  };
}

export function applyToolUseChunkToStreamState(
  state: ChatStreamState,
  chunk: StreamChunk,
  isPendingApproval: boolean,
): ChatStreamState {
  const toolUse = chunk.toolUse;
  if (!toolUse) return state;

  const items = [...state.streamItems];
  const existingToolIndex = items.findIndex(
    (item) => item.type === 'tool' && item.toolCall.id === toolUse.id,
  );

  const isStreamStart = chunk.toolUseComplete === false;
  const isStreamEnd = chunk.toolUseComplete === true;

  if (existingToolIndex >= 0) {
    const existingItem = items[existingToolIndex];
    if (existingItem.type === 'tool') {
      const prevStatus = existingItem.toolCall.status;

      let nextStatus = prevStatus;
      if (isPendingApproval) {
        nextStatus = 'pending';
      } else if (isStreamEnd && (prevStatus === 'queued' || prevStatus === 'running')) {
        nextStatus = 'running';
      }

      const hasRealInput = Object.keys(toolUse.input).length > 0;

      items[existingToolIndex] = {
        type: 'tool',
        toolCall: {
          ...existingItem.toolCall,
          name: toolUse.name || existingItem.toolCall.name,
          input: hasRealInput ? toolUse.input : existingItem.toolCall.input,
          // Keep inputText as display fallback until real parsed input arrives
          inputText: (isStreamEnd && hasRealInput) ? undefined : existingItem.toolCall.inputText,
          inputStreaming: isStreamStart && !isStreamEnd,
          status: nextStatus,
        },
      };
    }
  } else {
    items.push({
      type: 'tool',
      toolCall: {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
        status: isPendingApproval ? 'pending' : 'queued',
        inputText: isStreamStart ? '' : undefined,
        inputStreaming: isStreamStart,
      },
    });
  }

  return {
    ...cloneWithItems(state, items),
    pendingApprovalId: isPendingApproval ? toolUse.id : state.pendingApprovalId,
    isWaitingResponse: false,
  };
}

export function applyToolStartChunkToStreamState(state: ChatStreamState, chunk: StreamChunk): ChatStreamState {
  const toolUse = chunk.toolUse;
  if (!toolUse) return state;

  const items = [...state.streamItems];
  const existingToolIndex = items.findIndex(
    (item) => item.type === 'tool' && item.toolCall.id === toolUse.id,
  );

  if (existingToolIndex >= 0) {
    const existingItem = items[existingToolIndex];
    if (existingItem.type === 'tool' && existingItem.toolCall.status !== 'pending') {
      items[existingToolIndex] = {
        type: 'tool',
        toolCall: {
          ...existingItem.toolCall,
          status: 'running' as const,
        },
      };
    }
  }

  return {
    ...cloneWithItems(state, items),
    isWaitingResponse: false,
  };
}

export function applyToolResultChunkToStreamState(state: ChatStreamState, chunk: StreamChunk): ChatStreamState {
  const items = [...state.streamItems];
  const targetToolId = chunk.toolUse?.id;

  if (targetToolId) {
    const targetToolIndex = items.findIndex(
      (item) => item.type === 'tool' && item.toolCall.id === targetToolId,
    );

    if (targetToolIndex >= 0) {
      const targetItem = items[targetToolIndex];
      if (targetItem.type === 'tool') {
        items[targetToolIndex] = {
          type: 'tool',
          toolCall: cloneToolCallWithResult(targetItem.toolCall, chunk.content),
        };
        return cloneWithItems(state, items);
      }
    }
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.type === 'tool' && (item.toolCall.status === 'running' || item.toolCall.status === 'queued')) {
      items[i] = {
        type: 'tool',
        toolCall: cloneToolCallWithResult(item.toolCall, chunk.content),
      };
      break;
    }
  }

  return cloneWithItems(state, items);
}

export function applyProcessingToStreamState(state: ChatStreamState): ChatStreamState {
  return {
    ...state,
    isWaitingResponse: true,
  };
}

export function applyApproveToolCallToStreamState(state: ChatStreamState, id: string): ChatStreamState {
  const updatedItems = state.streamItems.map((item) => {
    if (item.type === 'tool' && item.toolCall.id === id) {
      return { ...item, toolCall: { ...item.toolCall, status: 'running' as const } };
    }
    return item;
  });

  return {
    ...state,
    streamItems: updatedItems,
    pendingApprovalId: null,
  };
}

export function applyRejectToolCallToStreamState(state: ChatStreamState, id: string): ChatStreamState {
  const updatedItems = state.streamItems.map((item) => {
    if (item.type === 'tool' && item.toolCall.id === id) {
      return {
        ...item,
        toolCall: { ...item.toolCall, status: 'error' as const, error: '用户拒绝执行' },
      };
    }
    return item;
  });

  return {
    ...state,
    streamItems: updatedItems,
    pendingApprovalId: null,
  };
}

export function applyToolApprovalRequestToStreamState(
  state: ChatStreamState,
  toolName: string,
  approvalMeta?: { decisionReason?: string; blockedPath?: string; suggestions?: unknown[] },
): { nextState: ChatStreamState; matchedPendingId: string | null } {
  let matchedPendingId: string | null = null;

  const items = state.streamItems.map((item) => {
    if (
      item.type === 'tool' &&
      item.toolCall.name === toolName &&
      (item.toolCall.status === 'running' || item.toolCall.status === 'queued')
    ) {
      matchedPendingId = item.toolCall.id;
      return {
        ...item,
        toolCall: {
          ...item.toolCall,
          status: 'pending' as const,
          decisionReason: approvalMeta?.decisionReason,
          blockedPath: approvalMeta?.blockedPath,
          suggestions: approvalMeta?.suggestions as import('../../types').PermissionSuggestion[] | undefined,
        },
      };
    }

    return item;
  });

  if (!matchedPendingId) {
    return {
      nextState: {
        ...state,
        streamItems: items,
        isWaitingResponse: false,
      },
      matchedPendingId: null,
    };
  }

  return {
    nextState: {
      ...state,
      streamItems: items,
      pendingApprovalId: matchedPendingId,
      isWaitingResponse: false,
    },
    matchedPendingId,
  };
}

export function getTextContentFromStreamItems(streamItems: MessageItem[]): string {
  return streamItems
    .filter((item): item is { type: 'text'; content: string } => item.type === 'text')
    .map((item) => item.content)
    .join('');
}
