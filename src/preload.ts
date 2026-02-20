import { contextBridge, ipcRenderer } from 'electron';

// IPC channel names - inlined to avoid module import issues in preload
const IPC_CHANNELS = {
  SEND_MESSAGE: 'send-message',
  SEND_MESSAGE_STREAM: 'send-message-stream',
  SET_MODEL_CONFIG: 'set-model-config',
  TEST_CONNECTION: 'test-connection',
  ABORT_STREAM: 'abort-stream',
  ENCRYPT_DATA: 'encrypt-data',
  DECRYPT_DATA: 'decrypt-data',
  STREAM_CHUNK: 'stream-chunk',
} as const;

// Store listener references for proper cleanup
let streamChunkListener: ((_event: Electron.IpcRendererEvent, chunk: unknown) => void) | null = null;

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, message, systemPrompt),

  sendMessageStream: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE_STREAM, message, systemPrompt),

  onStreamChunk: (callback: (chunk: { type: string; content: string }) => void) => {
    if (streamChunkListener) {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
    }
    streamChunkListener = (_event: Electron.IpcRendererEvent, chunk: unknown) => callback(chunk as { type: string; content: string });
    ipcRenderer.on(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
  },

  removeStreamListener: () => {
    if (streamChunkListener) {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
      streamChunkListener = null;
    }
  },

  setModelConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MODEL_CONFIG, config),

  testConnection: () =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CONNECTION),

  abortStream: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ABORT_STREAM),

  encryptData: (data: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENCRYPT_DATA, data),

  decryptData: (encryptedData: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DECRYPT_DATA, encryptedData),
});

// Type definitions for the exposed API
export type ElectronAPI = {
  sendMessage: (message: string, systemPrompt?: string) => Promise<string>;
  sendMessageStream: (message: string, systemPrompt?: string) => Promise<boolean>;
  onStreamChunk: (callback: (chunk: { type: string; content: string }) => void) => void;
  removeStreamListener: () => void;
  setModelConfig: (config: Record<string, unknown>) => Promise<boolean>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
  abortStream: () => Promise<void>;
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;
};
