import { create } from 'zustand';
import type { Provider } from '../../types';
import { electronApiClient } from '@/services/electron-api-client';

// 所有可用的工具列表
export const ALL_TOOLS = [
  { name: 'read_file', label: '读取文件', defaultAllowed: true },
  { name: 'write_file', label: '写入文件', defaultAllowed: false },
  { name: 'edit_file', label: '编辑文件', defaultAllowed: false },
  { name: 'list_directory', label: '列出目录', defaultAllowed: true },
  { name: 'search_files', label: '搜索文件', defaultAllowed: true },
  { name: 'grep_search', label: '内容搜索', defaultAllowed: true },
  { name: 'run_command', label: '执行命令', defaultAllowed: false },
  { name: 'web_fetch', label: '获取网页', defaultAllowed: true },
  { name: 'get_system_info', label: '系统信息', defaultAllowed: true },
] as const;

export type ToolName = typeof ALL_TOOLS[number]['name'];

interface ConfigState {
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string;
  allowedTools: string[];
  sessionAllowedTools: string[];
  allowAllForSession: boolean;
  isSettingsOpen: boolean;
  connectionStatus: { connected: boolean; message: string };

  setProvider: (provider: Provider) => void;
  setModel: (model: string) => void;
  setApiKey: (apiKey: string) => void;
  setBaseURL: (baseURL: string) => void;
  setAllowedTools: (tools: string[]) => void;
  toggleTool: (tool: string) => void;
  allowToolForSession: (tool: string) => void;
  setAllowAllForSession: (allow: boolean) => void;
  clearSessionAllowedTools: () => void;
  setSettingsOpen: (open: boolean) => void;
  setConnectionStatus: (status: { connected: boolean; message: string }) => void;
  isToolAllowed: (tool: string) => boolean;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  testConnection: () => Promise<void>;
}

const DEFAULT_ALLOWED_TOOLS = ALL_TOOLS
  .filter((tool) => tool.defaultAllowed)
  .map((tool) => tool.name);

export const useConfigStore = create<ConfigState>((set, get) => ({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  baseURL: '',
  allowedTools: DEFAULT_ALLOWED_TOOLS,
  sessionAllowedTools: [],
  allowAllForSession: false,
  isSettingsOpen: false,
  connectionStatus: { connected: false, message: '未配置' },

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setApiKey: (apiKey) => set({ apiKey }),
  setBaseURL: (baseURL) => set({ baseURL }),
  setAllowedTools: (tools) => set({ allowedTools: tools }),

  toggleTool: (tool) => set((state) => {
    const isAllowed = state.allowedTools.includes(tool);
    return {
      allowedTools: isAllowed
        ? state.allowedTools.filter((t) => t !== tool)
        : [...state.allowedTools, tool],
    };
  }),

  allowToolForSession: (tool) => set((state) => ({
    sessionAllowedTools: state.sessionAllowedTools.includes(tool)
      ? state.sessionAllowedTools
      : [...state.sessionAllowedTools, tool],
  })),

  setAllowAllForSession: (allow) => set({ allowAllForSession: allow }),
  clearSessionAllowedTools: () => set({ sessionAllowedTools: [], allowAllForSession: false }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  isToolAllowed: (tool) => {
    const state = get();
    return (
      state.allowAllForSession ||
      state.allowedTools.includes(tool) ||
      state.sessionAllowedTools.includes(tool)
    );
  },

  loadConfig: async () => {
    try {
      const savedTools = localStorage.getItem('allowedTools');
      if (savedTools) {
        try {
          set({ allowedTools: JSON.parse(savedTools) });
        } catch {
          console.warn('Failed to parse allowedTools');
        }
      }

      const config = await electronApiClient.configLoad();
      if (!config || Object.keys(config).length === 0) return;

      const provider = (config.provider as Provider) || 'anthropic';
      const model = config.model || '';
      const baseURL = config.baseURL || '';
      let apiKey = '';

      set({ provider, model, baseURL });

      if (config.apiKey) {
        try {
          apiKey = await electronApiClient.decryptData(config.apiKey);
          set({ apiKey });
        } catch {
          console.warn('Failed to decrypt API key');
        }
      }

      if (apiKey) {
        await electronApiClient.setModelConfig({
          provider,
          model,
          baseURL: baseURL || undefined,
          apiKey,
        });
        set({ connectionStatus: { connected: true, message: '已配置' } });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  },

  saveConfig: async () => {
    const { provider, model, apiKey, baseURL, allowedTools } = get();
    try {
      let encryptedKey = '';
      if (apiKey) {
        encryptedKey = await electronApiClient.encryptData(apiKey);
      }

      localStorage.setItem('allowedTools', JSON.stringify(allowedTools));

      await electronApiClient.configSave({
        provider,
        model,
        baseURL: baseURL || undefined,
        apiKey: encryptedKey,
      });

      await electronApiClient.setModelConfig({
        provider,
        model,
        baseURL: baseURL || undefined,
        apiKey,
      });

      set({ connectionStatus: { connected: true, message: '已保存' }, isSettingsOpen: false });
    } catch (error) {
      console.error('Save config error:', error);
      set({ connectionStatus: { connected: false, message: '保存失败' } });
    }
  },

  testConnection: async () => {
    const { provider, model, apiKey, baseURL } = get();
    set({ connectionStatus: { connected: false, message: '测试中...' } });

    try {
      await electronApiClient.setModelConfig({
        provider,
        model,
        apiKey,
        baseURL: baseURL || undefined,
      });

      const result = await electronApiClient.testConnection();
      set({
        connectionStatus: {
          connected: result.success,
          message: result.success ? '连接成功' : result.message,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      set({ connectionStatus: { connected: false, message: `测试失败: ${errorMessage}` } });
    }
  },
}));
