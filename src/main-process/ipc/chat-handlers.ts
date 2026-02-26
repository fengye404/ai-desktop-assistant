/**
 * IPC handlers for chat operations. Bridges renderer requests to AgentService.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { ModelConfig, StreamChunk } from '../../types';
import type { MainProcessContext } from '../main-process-context';

function sendStreamChunk(context: MainProcessContext, chunk: StreamChunk): void {
  const window = context.getMainWindow();
  if (!window || window.isDestroyed()) return;
  window.webContents.send(IPC_CHANNELS.STREAM_CHUNK, chunk);
}

export function registerChatHandlers(context: MainProcessContext): void {
  ipcMain.handle(
    IPC_CHANNELS.SEND_MESSAGE_STREAM,
    async (_event, message: string, systemPrompt?: string) => {
      const service = context.getAgentServiceOrThrow();
      const resolvedMessage = context.resolveUserMessage(message);
      const prompt = resolvedMessage.modelMessage || message;

      try {
        const stream = service.sendMessageStream(prompt, {
          systemPrompt,
        });

        for await (const chunk of stream) {
          sendStreamChunk(context, chunk);
        }

        sendStreamChunk(context, { type: 'done', content: '' });
        return true;
      } catch (error) {
        console.error('[main] Stream error:', error);
        sendStreamChunk(context, {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE, async (_event, message: string, systemPrompt?: string) => {
    const service = context.getAgentServiceOrThrow();
    const resolvedMessage = context.resolveUserMessage(message);
    const prompt = resolvedMessage.modelMessage || message;

    const chunks: string[] = [];
    for await (const chunk of service.sendMessageStream(prompt, { systemPrompt })) {
      if (chunk.type === 'text') chunks.push(chunk.content);
      if (chunk.type === 'error') throw new Error(chunk.content);
    }
    return chunks.join('');
  });

  ipcMain.handle(IPC_CHANNELS.ABORT_STREAM, async () => {
    const service = context.getAgentServiceOrThrow();
    service.abort();
  });

  ipcMain.handle(IPC_CHANNELS.SET_MODEL_CONFIG, async (_event, config: Partial<ModelConfig>) => {
    const service = context.getAgentServiceOrThrow();
    service.setConfig({
      provider: config.provider,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
    });
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TEST_CONNECTION, async () => {
    try {
      const service = context.getAgentServiceOrThrow();
      const chunks: string[] = [];
      for await (const chunk of service.sendMessageStream('Hi')) {
        if (chunk.type === 'text') chunks.push(chunk.content);
        if (chunk.type === 'error') return { success: false, message: chunk.content };
      }
      return { success: true, message: '连接成功！' };
    } catch (error) {
      return { success: false, message: `连接失败: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
    // SDK manages history; clear is a no-op or starts a new session
  });

  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.COMPACT_HISTORY, async () => {
    return {
      success: true,
      skipped: true,
      reason: 'SDK 自动管理上下文压缩',
      beforeMessageCount: 0,
      afterMessageCount: 0,
      removedMessageCount: 0,
      beforeEstimatedTokens: 0,
      afterEstimatedTokens: 0,
    };
  });

  ipcMain.handle(IPC_CHANNELS.REWIND_LAST_TURN, async () => {
    return {
      success: true,
      skipped: true,
      reason: 'SDK 管理会话历史',
      removedMessageCount: 0,
      remainingMessageCount: 0,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTOCOMPLETE_PATHS, async (_event, partialPath: string) => {
    return context.autocompletePaths(partialPath);
  });
}
