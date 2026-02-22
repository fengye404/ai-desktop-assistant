import type {
  ChatMessage,
  CompactHistoryResult,
  ConnectionTestResult,
  ElectronAPI,
  McpRefreshResult,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
  ModelConfig,
  PathAutocompleteItem,
  Session,
  SessionMeta,
  StreamChunk,
  ToolApprovalRequest,
} from '../../types';

let missingApiWarningPrinted = false;

function hasApiBridge(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

function getApiOrNull(): ElectronAPI | null {
  if (hasApiBridge()) {
    return window.electronAPI;
  }

  if (!missingApiWarningPrinted) {
    console.error('[renderer] window.electronAPI is unavailable. preload bridge may have failed to load.');
    missingApiWarningPrinted = true;
  }

  return null;
}

function rejectUnavailable<T>(method: string): Promise<T> {
  return Promise.reject(new Error(`[renderer] Electron API unavailable: ${method}`));
}

export const electronApiClient = {
  isAvailable: () => hasApiBridge(),

  sendMessage: (message: string, systemPrompt?: string) => {
    const api = getApiOrNull();
    return api ? api.sendMessage(message, systemPrompt) : rejectUnavailable('sendMessage');
  },

  sendMessageStream: (message: string, systemPrompt?: string) => {
    const api = getApiOrNull();
    return api ? api.sendMessageStream(message, systemPrompt) : rejectUnavailable('sendMessageStream');
  },

  onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
    const api = getApiOrNull();
    if (!api) return;
    api.onStreamChunk(callback);
  },

  removeStreamListener: () => {
    const api = getApiOrNull();
    if (!api) return;
    api.removeStreamListener();
  },

  setModelConfig: (config: Partial<ModelConfig>) => {
    const api = getApiOrNull();
    return api ? api.setModelConfig(config) : Promise.resolve(false);
  },

  testConnection: (): Promise<ConnectionTestResult> => {
    const api = getApiOrNull();
    if (!api) {
      return Promise.resolve({
        success: false,
        message: 'Electron API unavailable',
      });
    }
    return api.testConnection();
  },

  abortStream: () => {
    const api = getApiOrNull();
    return api ? api.abortStream() : Promise.resolve();
  },

  encryptData: (data: string) => {
    const api = getApiOrNull();
    return api ? api.encryptData(data) : Promise.resolve(`plain:${data}`);
  },

  decryptData: (encryptedData: string) => {
    const api = getApiOrNull();
    if (!api) {
      return Promise.resolve(
        encryptedData.startsWith('plain:') ? encryptedData.slice(6) : encryptedData,
      );
    }
    return api.decryptData(encryptedData);
  },

  clearHistory: () => {
    const api = getApiOrNull();
    return api ? api.clearHistory() : Promise.resolve();
  },

  getHistory: (): Promise<ChatMessage[]> => {
    const api = getApiOrNull();
    return api ? api.getHistory() : Promise.resolve([]);
  },

  compactHistory: (): Promise<CompactHistoryResult> => {
    const api = getApiOrNull();
    return api ? api.compactHistory() : rejectUnavailable('compactHistory');
  },

  autocompletePaths: (partialPath: string): Promise<PathAutocompleteItem[]> => {
    const api = getApiOrNull();
    return api ? api.autocompletePaths(partialPath) : Promise.resolve([]);
  },

  sessionList: (): Promise<SessionMeta[]> => {
    const api = getApiOrNull();
    return api ? api.sessionList() : Promise.resolve([]);
  },

  sessionGet: (id: string): Promise<Session | null> => {
    const api = getApiOrNull();
    return api ? api.sessionGet(id) : Promise.resolve(null);
  },

  sessionCreate: (title?: string): Promise<Session> => {
    const api = getApiOrNull();
    return api ? api.sessionCreate(title) : rejectUnavailable('sessionCreate');
  },

  sessionDelete: (id: string): Promise<boolean> => {
    const api = getApiOrNull();
    return api ? api.sessionDelete(id) : Promise.resolve(false);
  },

  sessionSwitch: (id: string): Promise<Session | null> => {
    const api = getApiOrNull();
    return api ? api.sessionSwitch(id) : Promise.resolve(null);
  },

  sessionRename: (id: string, title: string): Promise<boolean> => {
    const api = getApiOrNull();
    return api ? api.sessionRename(id, title) : Promise.resolve(false);
  },

  configSave: (config: Partial<ModelConfig>): Promise<boolean> => {
    const api = getApiOrNull();
    return api ? api.configSave(config) : Promise.resolve(false);
  },

  configLoad: (): Promise<Partial<ModelConfig>> => {
    const api = getApiOrNull();
    return api ? api.configLoad() : Promise.resolve({});
  },

  mcpListServers: (): Promise<McpServerStatus[]> => {
    const api = getApiOrNull();
    return api ? api.mcpListServers() : Promise.resolve([]);
  },

  mcpListTools: (): Promise<McpToolInfo[]> => {
    const api = getApiOrNull();
    return api ? api.mcpListTools() : Promise.resolve([]);
  },

  mcpRefresh: (): Promise<McpRefreshResult> => {
    const api = getApiOrNull();
    return api ? api.mcpRefresh() : rejectUnavailable('mcpRefresh');
  },

  mcpUpsertServer: (name: string, config: McpServerConfig): Promise<McpRefreshResult> => {
    const api = getApiOrNull();
    return api ? api.mcpUpsertServer(name, config) : rejectUnavailable('mcpUpsertServer');
  },

  mcpRemoveServer: (name: string): Promise<McpRefreshResult> => {
    const api = getApiOrNull();
    return api ? api.mcpRemoveServer(name) : rejectUnavailable('mcpRemoveServer');
  },

  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => {
    const api = getApiOrNull();
    if (!api) return;
    api.onToolApprovalRequest(callback);
  },

  respondToolApproval: (approved: boolean) => {
    const api = getApiOrNull();
    if (!api) return;
    api.respondToolApproval(approved);
  },
};
