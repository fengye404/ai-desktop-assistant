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
  CLEAR_HISTORY: 'clear-history',
  GET_HISTORY: 'get-history',
  SESSION_LIST: 'session-list',
  SESSION_GET: 'session-get',
  SESSION_CREATE: 'session-create',
  SESSION_DELETE: 'session-delete',
  SESSION_SWITCH: 'session-switch',
  SESSION_RENAME: 'session-rename',
  CONFIG_SAVE: 'config-save',
  CONFIG_LOAD: 'config-load',
  STREAM_CHUNK: 'stream-chunk',
  TOOL_APPROVAL_REQUEST: 'tool-approval-request',
  TOOL_APPROVAL_RESPONSE: 'tool-approval-response',
} as const;

// Store listener references for proper cleanup
let streamChunkListener: ((_event: Electron.IpcRendererEvent, chunk: unknown) => void) | null = null;
let toolApprovalListener: ((_event: Electron.IpcRendererEvent, request: unknown) => void) | null = null;

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

  clearHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),

  getHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),

  // Session management
  sessionList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),

  sessionGet: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET, id),

  sessionCreate: (title?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, title),

  sessionDelete: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),

  sessionSwitch: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_SWITCH, id),

  sessionRename: (id: string, title: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_RENAME, id, title),

  // Config management
  configSave: (config: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config),

  configLoad: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LOAD),

  // Tool system
  onToolApprovalRequest: (callback: (request: { tool: string; input: Record<string, unknown>; description: string }) => void) => {
    if (toolApprovalListener) {
      ipcRenderer.removeListener(IPC_CHANNELS.TOOL_APPROVAL_REQUEST, toolApprovalListener);
    }
    toolApprovalListener = (_event: Electron.IpcRendererEvent, request: unknown) =>
      callback(request as { tool: string; input: Record<string, unknown>; description: string });
    ipcRenderer.on(IPC_CHANNELS.TOOL_APPROVAL_REQUEST, toolApprovalListener);
  },

  respondToolApproval: (approved: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.TOOL_APPROVAL_RESPONSE, approved),
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
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<{ role: string; content: string; timestamp?: number }[]>;
  sessionList: () => Promise<
    { id: string; title: string; messageCount: number; createdAt: number; updatedAt: number; preview: string }[]
  >;
  sessionGet: (id: string) => Promise<{
    id: string;
    title: string;
    messages: { role: string; content: string; timestamp?: number }[];
    createdAt: number;
    updatedAt: number;
  } | null>;
  sessionCreate: (title?: string) => Promise<{
    id: string;
    title: string;
    messages: { role: string; content: string; timestamp?: number }[];
    createdAt: number;
    updatedAt: number;
  }>;
  sessionDelete: (id: string) => Promise<boolean>;
  sessionSwitch: (id: string) => Promise<{
    id: string;
    title: string;
    messages: { role: string; content: string; timestamp?: number }[];
    createdAt: number;
    updatedAt: number;
  } | null>;
  sessionRename: (id: string, title: string) => Promise<boolean>;
};
