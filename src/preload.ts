import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, ModelConfig, StreamChunk } from './types';
import { IPC_CHANNELS } from './types';

// Store listener references for proper cleanup
let streamChunkListener: ((_event: Electron.IpcRendererEvent, chunk: StreamChunk) => void) | null = null;

// Expose protected methods to the renderer process
const electronAPI: ElectronAPI = {
  sendMessage: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, message, systemPrompt),

  sendMessageStream: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE_STREAM, message, systemPrompt),

  onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
    // Remove existing listener if any
    if (streamChunkListener) {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
    }

    // Create and store new listener
    streamChunkListener = (_event: Electron.IpcRendererEvent, chunk: StreamChunk) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
  },

  removeStreamListener: () => {
    if (streamChunkListener) {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
      streamChunkListener = null;
    }
  },

  setModelConfig: (config: Partial<ModelConfig>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MODEL_CONFIG, config),

  testConnection: () =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CONNECTION),

  abortStream: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ABORT_STREAM),

  encryptData: (data: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENCRYPT_DATA, data),

  decryptData: (encryptedData: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DECRYPT_DATA, encryptedData),
};

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Re-export types for use in other files
export type { ElectronAPI, ModelConfig, StreamChunk } from './types';
