import assert from 'node:assert/strict';
import test from 'node:test';
import type { StreamChunk, ToolCallRecord } from '../../../types';
import {
  appendTextToStreamState,
  applyApproveToolCallToStreamState,
  applyProcessingToStreamState,
  applyRejectToolCallToStreamState,
  applyToolApprovalRequestToStreamState,
  applyToolInputBufferUpdates,
  applyToolResultChunkToStreamState,
  applyToolStartChunkToStreamState,
  applyToolUseChunkToStreamState,
  getInitialChatStreamState,
  getTextContentFromStreamItems,
  type ChatStreamState,
} from '../chat-stream-state';

function buildToolUseChunk(
  id: string,
  name: string,
  input: Record<string, unknown> = {},
  toolUseComplete?: boolean,
): StreamChunk {
  return {
    type: 'tool_use',
    content: '',
    toolUse: { id, name, input },
    toolUseComplete,
  };
}

function buildToolStartChunk(id: string, name: string): StreamChunk {
  return {
    type: 'tool_start',
    content: '',
    toolUse: { id, name, input: {} },
  };
}

function buildToolResultChunk(content: string, toolId?: string): StreamChunk {
  return {
    type: 'tool_result',
    content,
    toolUse: toolId ? { id: toolId, name: 'run_command', input: {} } : undefined,
  };
}

function buildStateWithTool(toolCall: ToolCallRecord): ChatStreamState {
  return {
    streamItems: [{ type: 'tool', toolCall }],
    pendingApprovalId: null,
    isWaitingResponse: false,
  };
}

test('appendTextToStreamState merges contiguous text chunks', () => {
  let state = getInitialChatStreamState();
  state = appendTextToStreamState(state, 'Hello');
  state = appendTextToStreamState(state, ' World');

  assert.equal(state.streamItems.length, 1);
  assert.equal(state.streamItems[0]?.type, 'text');
  if (state.streamItems[0]?.type === 'text') {
    assert.equal(state.streamItems[0].content, 'Hello World');
  }
  assert.equal(state.isWaitingResponse, false);
});

test('applyToolInputBufferUpdates creates and updates streaming tool items', () => {
  let state = getInitialChatStreamState();

  state = applyToolInputBufferUpdates(state, [
    ['tool-1', { name: 'read_file', accumulated: '{"path":"README.md"}' }],
  ]);
  assert.equal(state.streamItems.length, 1);
  assert.equal(state.streamItems[0]?.type, 'tool');
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'running');
    assert.equal(state.streamItems[0].toolCall.inputStreaming, true);
    assert.equal(state.streamItems[0].toolCall.inputText, '{"path":"README.md"}');
  }

  state = applyToolInputBufferUpdates(state, [
    ['tool-1', { name: 'read_file', accumulated: '{"path":"README.md","limit":20}' }],
  ]);
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.inputText, '{"path":"README.md","limit":20}');
  }
});

test('tool use/start/result reducers keep expected status transitions', () => {
  const queuedTool: ToolCallRecord = {
    id: 'tool-1',
    name: 'run_command',
    input: { command: 'ls' },
    status: 'queued',
  };

  let state = buildStateWithTool(queuedTool);
  state = applyToolUseChunkToStreamState(state, buildToolUseChunk('tool-1', 'run_command', { command: 'ls' }), true);
  assert.equal(state.pendingApprovalId, 'tool-1');
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'pending');
  }

  state = applyToolStartChunkToStreamState(state, buildToolStartChunk('tool-1', 'run_command'));
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'pending');
  }

  state = applyApproveToolCallToStreamState(state, 'tool-1');
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'running');
  }

  state = applyToolResultChunkToStreamState(state, buildToolResultChunk('done', 'tool-1'));
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'success');
    assert.equal(state.streamItems[0].toolCall.output, 'done');
  }
});

test('tool result reducer falls back to latest active tool when id is missing', () => {
  const runningTool: ToolCallRecord = {
    id: 'tool-2',
    name: 'run_command',
    input: { command: 'pwd' },
    status: 'running',
  };
  let state = buildStateWithTool(runningTool);
  state = applyToolResultChunkToStreamState(state, buildToolResultChunk('Tool run_command failed: timeout'));

  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'error');
    assert.match(state.streamItems[0].toolCall.error || '', /failed/i);
  }
});

test('tool approval request and rejection reducers work as expected', () => {
  const runningTool: ToolCallRecord = {
    id: 'tool-3',
    name: 'web_fetch',
    input: { url: 'https://example.com' },
    status: 'running',
  };

  let state = buildStateWithTool(runningTool);
  const { nextState, matchedPendingId } = applyToolApprovalRequestToStreamState(state, 'web_fetch');
  assert.equal(matchedPendingId, 'tool-3');
  state = nextState;

  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'pending');
  }

  state = applyRejectToolCallToStreamState(state, 'tool-3');
  if (state.streamItems[0]?.type === 'tool') {
    assert.equal(state.streamItems[0].toolCall.status, 'error');
    assert.equal(state.streamItems[0].toolCall.error, '用户拒绝执行');
  }
});

test('processing reducer and text extraction helper produce expected values', () => {
  let state = getInitialChatStreamState();
  state = applyProcessingToStreamState(state);
  assert.equal(state.isWaitingResponse, true);

  state = appendTextToStreamState(state, 'A');
  state = appendTextToStreamState(state, 'I');
  const text = getTextContentFromStreamItems(state.streamItems);
  assert.equal(text, 'AI');
});
