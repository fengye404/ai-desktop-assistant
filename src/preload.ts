import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './types';
import type { ElectronAPI, ModelConfig, StreamChunk, ToolApprovalRequest } from './types';

let streamChunkListener: ((_event: Electron.IpcRendererEvent, chunk: unknown) => void) | null = null;
let toolApprovalListener: ((_event: Electron.IpcRendererEvent, request: unknown) => void) | null = null;

function replaceListener(
  channel: string,
  currentListener: ((_event: Electron.IpcRendererEvent, payload: unknown) => void) | null,
  nextListener: (_event: Electron.IpcRendererEvent, payload: unknown) => void,
): (_event: Electron.IpcRendererEvent, payload: unknown) => void {
  if (currentListener) {
    ipcRenderer.removeListener(channel, currentListener);
  }
  ipcRenderer.on(channel, nextListener);
  return nextListener;
}

const electronAPI: ElectronAPI = {
  sendMessage: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, message, systemPrompt),

  sendMessageStream: (message: string, systemPrompt?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE_STREAM, message, systemPrompt),

  onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
    streamChunkListener = replaceListener(
      IPC_CHANNELS.STREAM_CHUNK,
      streamChunkListener,
      (_event, chunk) => callback(chunk as StreamChunk),
    );
  },

  removeStreamListener: () => {
    if (!streamChunkListener) return;
    ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, streamChunkListener);
    streamChunkListener = null;
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

  clearHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),

  getHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),

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

  configSave: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config),

  configLoad: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LOAD),

  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => {
    toolApprovalListener = replaceListener(
      IPC_CHANNELS.TOOL_APPROVAL_REQUEST,
      toolApprovalListener,
      (_event, request) => callback(request as ToolApprovalRequest),
    );
  },

  respondToolApproval: (approved: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.TOOL_APPROVAL_RESPONSE, approved),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
