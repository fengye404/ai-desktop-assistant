import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { ChatImageAttachment, ModelConfig, StreamChunk } from '../../types';
import { StreamAbortedError } from '../../utils/errors';
import type { MainProcessContext } from '../main-process-context';

function sendStreamChunk(context: MainProcessContext, chunk: StreamChunk): void {
  const window = context.getMainWindow();
  if (!window || window.isDestroyed()) return;
  window.webContents.send(IPC_CHANNELS.STREAM_CHUNK, chunk);
}

export function registerChatHandlers(context: MainProcessContext): void {
  ipcMain.handle(
    IPC_CHANNELS.SEND_MESSAGE,
    async (_event, message: string, systemPrompt?: string, attachments?: ChatImageAttachment[]) => {
      const service = context.getClaudeServiceOrThrow();
      const resolvedMessage = context.resolveUserMessage(message);
      return service.sendMessage(message, systemPrompt, {
        messageForModel: resolvedMessage.modelMessage,
        attachments,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SEND_MESSAGE_STREAM,
    async (_event, message: string, systemPrompt?: string, attachments?: ChatImageAttachment[]) => {
      const service = context.getClaudeServiceOrThrow();
      const resolvedMessage = context.resolveUserMessage(message);

      try {
        const stream = service.sendMessageStream(message, systemPrompt, {
          messageForModel: resolvedMessage.modelMessage,
          attachments,
        });

        for await (const chunk of stream) {
          sendStreamChunk(context, chunk);
        }

        sendStreamChunk(context, { type: 'done', content: '' });
        return true;
      } catch (error) {
        console.error('[main] Stream error:', error);

        if (error instanceof StreamAbortedError) {
          sendStreamChunk(context, { type: 'error', content: 'Response was cancelled' });
          return false;
        }

        sendStreamChunk(context, {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.ABORT_STREAM, async () => {
    const service = context.getClaudeServiceOrThrow();
    service.abort();
  });

  ipcMain.handle(IPC_CHANNELS.SET_MODEL_CONFIG, async (_event, config: Partial<ModelConfig>) => {
    const service = context.getClaudeServiceOrThrow();
    service.setConfig(config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.TEST_CONNECTION, async () => {
    const service = context.getClaudeServiceOrThrow();
    return service.testConnection();
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
    const service = context.getClaudeServiceOrThrow();
    service.clearHistory();
  });

  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    const service = context.getClaudeServiceOrThrow();
    return service.getHistory();
  });

  ipcMain.handle(IPC_CHANNELS.COMPACT_HISTORY, async () => {
    const service = context.getClaudeServiceOrThrow();
    return service.compactHistory();
  });

  ipcMain.handle(IPC_CHANNELS.REWIND_LAST_TURN, async () => {
    const service = context.getClaudeServiceOrThrow();
    return service.rewindLastTurn();
  });

  ipcMain.handle(IPC_CHANNELS.AUTOCOMPLETE_PATHS, async (_event, partialPath: string) => {
    return context.autocompletePaths(partialPath);
  });
}
