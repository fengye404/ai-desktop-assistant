import assert from 'node:assert/strict';
import test from 'node:test';
import type { StreamChunk, ToolApprovalRequest, ToolApprovalResponse } from '../../../types';
import { createChatStreamListener } from '../chat-stream-listener';
import { getInitialChatStreamState, type ChatStreamState } from '../chat-stream-state';

function createHarness(options?: { isToolAllowed?: (tool: string) => boolean }) {
  let state: ChatStreamState = getInitialChatStreamState();
  const approvalResponses: ToolApprovalResponse[] = [];
  const donePayloads: Array<Array<{ type: string }>> = [];
  const errors: string[] = [];

  const listener = createChatStreamListener({
    getState: () => state,
    updateState: (updater) => {
      state = updater(state);
    },
    onDone: (streamItems) => {
      donePayloads.push(streamItems.map((item) => ({ type: item.type })));
    },
    onError: (message) => {
      errors.push(message);
    },
    isToolAllowed: options?.isToolAllowed ?? (() => false),
    respondToolApproval: (response) => {
      approvalResponses.push(response);
    },
    textFlushIntervalMs: 2000,
    toolInputFlushIntervalMs: 2000,
  });

  return {
    listener,
    getState: () => state,
    approvalResponses,
    donePayloads,
    errors,
  };
}

function toolUseChunk(id: string, name: string): StreamChunk {
  return {
    type: 'tool_use',
    content: '',
    toolUse: { id, name, input: {} },
    toolUseComplete: true,
  };
}

function doneChunk(): StreamChunk {
  return { type: 'done', content: '' };
}

function errorChunk(message: string): StreamChunk {
  return { type: 'error', content: message };
}

function approvalRequest(tool: string): ToolApprovalRequest {
  return {
    tool,
    input: {},
    description: '',
    toolUseID: `test-${tool}`,
  };
}

test('buffers text until flush and then merges into one text item', () => {
  const harness = createHarness();
  harness.listener.handleChunk({ type: 'text', content: 'Hel' });
  harness.listener.handleChunk({ type: 'text', content: 'lo' });

  assert.equal(harness.getState().streamItems.length, 0);

  harness.listener.flushPendingBuffers();
  const items = harness.getState().streamItems;
  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, 'text');
  if (items[0]?.type === 'text') {
    assert.equal(items[0].content, 'Hello');
  }
});

test('queued approval is consumed when tool_use arrives later', () => {
  const harness = createHarness();

  harness.listener.handleToolApprovalRequest(approvalRequest('run_command'));
  assert.equal(harness.getState().pendingApprovalId, null);

  harness.listener.handleChunk(toolUseChunk('tool-1', 'run_command'));
  const items = harness.getState().streamItems;
  assert.equal(harness.getState().pendingApprovalId, 'tool-1');
  assert.equal(items[0]?.type, 'tool');
  if (items[0]?.type === 'tool') {
    assert.equal(items[0].toolCall.status, 'pending');
  }
});

test('auto-allowed approval request sends immediate approval response', () => {
  const harness = createHarness({ isToolAllowed: () => true });
  harness.listener.handleToolApprovalRequest(approvalRequest('read_file'));

  assert.deepEqual(harness.approvalResponses, [{ approved: true }]);
  assert.equal(harness.getState().streamItems.length, 0);
});

test('done chunk flushes buffered content and triggers completion callback', () => {
  const harness = createHarness();
  harness.listener.handleChunk({ type: 'text', content: 'A' });
  harness.listener.handleChunk(doneChunk());

  assert.equal(harness.donePayloads.length, 1);
  assert.deepEqual(harness.donePayloads[0], [{ type: 'text' }]);
});

test('error chunk triggers error callback', () => {
  const harness = createHarness();
  harness.listener.handleChunk(errorChunk('boom'));

  assert.deepEqual(harness.errors, ['boom']);
});
