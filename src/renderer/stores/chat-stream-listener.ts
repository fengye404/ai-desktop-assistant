import type { MessageItem, StreamChunk, ToolApprovalRequest } from '../../types';
import type { ChatStreamState } from './chat-stream-state';
import {
  appendTextToStreamState,
  applyProcessingToStreamState,
  applyToolApprovalRequestToStreamState,
  applyToolInputBufferUpdates,
  applyToolResultChunkToStreamState,
  applyToolStartChunkToStreamState,
  applyToolUseChunkToStreamState,
} from './chat-stream-state';

interface ChatStreamListenerDependencies {
  getState: () => ChatStreamState;
  updateState: (updater: (state: ChatStreamState) => ChatStreamState) => void;
  onDone: (streamItems: MessageItem[]) => void;
  onError: (message: string) => void;
  isToolAllowed: (tool: string) => boolean;
  respondToolApproval: (approved: boolean) => void;
  textFlushIntervalMs?: number;
  toolInputFlushIntervalMs?: number;
}

export interface ChatStreamListener {
  handleChunk: (chunk: StreamChunk) => void;
  handleToolApprovalRequest: (request: ToolApprovalRequest) => void;
  flushPendingBuffers: () => void;
  dispose: () => void;
}

const DEFAULT_TEXT_FLUSH_INTERVAL_MS = 33;
const DEFAULT_TOOL_INPUT_FLUSH_INTERVAL_MS = 50;

export function createChatStreamListener(deps: ChatStreamListenerDependencies): ChatStreamListener {
  const textFlushIntervalMs = deps.textFlushIntervalMs ?? DEFAULT_TEXT_FLUSH_INTERVAL_MS;
  const toolInputFlushIntervalMs = deps.toolInputFlushIntervalMs ?? DEFAULT_TOOL_INPUT_FLUSH_INTERVAL_MS;

  let textBuffer = '';
  let textFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let toolInputFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const toolInputBuffer = new Map<string, { name: string; accumulated: string }>();
  const queuedApprovalsByTool = new Map<string, number>();

  const appendTextChunk = (text: string) => {
    if (!text) return;
    deps.updateState((state) => appendTextToStreamState(state, text));
  };

  const flushTextBuffer = () => {
    if (!textBuffer) return;
    const bufferedText = textBuffer;
    textBuffer = '';
    appendTextChunk(bufferedText);
  };

  const flushToolInputBuffer = () => {
    if (toolInputBuffer.size === 0) return;
    const pendingUpdates = Array.from(toolInputBuffer.entries());
    toolInputBuffer.clear();
    deps.updateState((state) => applyToolInputBufferUpdates(state, pendingUpdates));
  };

  const clearScheduledFlush = () => {
    if (textFlushTimer !== null) {
      clearTimeout(textFlushTimer);
      textFlushTimer = null;
    }

    if (toolInputFlushTimer !== null) {
      clearTimeout(toolInputFlushTimer);
      toolInputFlushTimer = null;
    }
  };

  const scheduleTextFlush = () => {
    if (textFlushTimer !== null) return;
    textFlushTimer = setTimeout(() => {
      textFlushTimer = null;
      flushTextBuffer();
    }, textFlushIntervalMs);
  };

  const scheduleToolInputFlush = () => {
    if (toolInputFlushTimer !== null) return;
    toolInputFlushTimer = setTimeout(() => {
      toolInputFlushTimer = null;
      flushToolInputBuffer();
    }, toolInputFlushIntervalMs);
  };

  const queueApprovalForTool = (toolName: string) => {
    const current = queuedApprovalsByTool.get(toolName) ?? 0;
    queuedApprovalsByTool.set(toolName, current + 1);
  };

  const consumeQueuedApproval = (toolName: string): boolean => {
    const current = queuedApprovalsByTool.get(toolName) ?? 0;
    if (current <= 0) return false;

    if (current === 1) {
      queuedApprovalsByTool.delete(toolName);
    } else {
      queuedApprovalsByTool.set(toolName, current - 1);
    }

    return true;
  };

  const flushPendingBuffers = () => {
    clearScheduledFlush();
    flushTextBuffer();
    flushToolInputBuffer();
  };

  const handleChunk = (chunk: StreamChunk) => {
    if (chunk.type === 'text') {
      textBuffer += chunk.content;
      scheduleTextFlush();
      return;
    }

    if (chunk.type === 'tool_input_delta' && chunk.toolInputDelta) {
      toolInputBuffer.set(chunk.toolInputDelta.id, {
        name: chunk.toolInputDelta.name,
        accumulated: chunk.toolInputDelta.accumulated,
      });
      scheduleToolInputFlush();
      return;
    }

    flushPendingBuffers();

    if (chunk.type === 'done') {
      deps.onDone(deps.getState().streamItems);
      return;
    }

    if (chunk.type === 'tool_use') {
      const toolUse = chunk.toolUse;
      if (!toolUse) return;

      const isPendingApproval = consumeQueuedApproval(toolUse.name);
      deps.updateState((state) => applyToolUseChunkToStreamState(state, chunk, isPendingApproval));
      return;
    }

    if (chunk.type === 'tool_start') {
      if (!chunk.toolUse) return;
      deps.updateState((state) => applyToolStartChunkToStreamState(state, chunk));
      return;
    }

    if (chunk.type === 'tool_result') {
      deps.updateState((state) => applyToolResultChunkToStreamState(state, chunk));
      return;
    }

    if (chunk.type === 'processing') {
      deps.updateState((state) => applyProcessingToStreamState(state));
      return;
    }

    if (chunk.type === 'error') {
      deps.onError(chunk.content);
    }
  };

  const handleToolApprovalRequest = (request: ToolApprovalRequest) => {
    if (deps.isToolAllowed(request.tool)) {
      deps.respondToolApproval(true);
      return;
    }

    deps.updateState((state) => {
      const { nextState, matchedPendingId } = applyToolApprovalRequestToStreamState(state, request.tool);
      if (!matchedPendingId) {
        queueApprovalForTool(request.tool);
      }
      return nextState;
    });
  };

  const dispose = () => {
    clearScheduledFlush();
    textBuffer = '';
    toolInputBuffer.clear();
    queuedApprovalsByTool.clear();
  };

  return {
    handleChunk,
    handleToolApprovalRequest,
    flushPendingBuffers,
    dispose,
  };
}
