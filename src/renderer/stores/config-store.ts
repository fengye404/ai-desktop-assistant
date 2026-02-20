import { create } from 'zustand';

export type Provider = 'anthropic' | 'openai';

interface ConfigState {
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string;
  isSettingsOpen: boolean;
  connectionStatus: { connected: boolean; message: string };

  setProvider: (provider: Provider) => void;
  setModel: (model: string) => void;
  setApiKey: (apiKey: string) => void;
  setBaseURL: (baseURL: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setConnectionStatus: (status: { connected: boolean; message: string }) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  testConnection: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  baseURL: '',
  isSettingsOpen: false,
  connectionStatus: { connected: false, message: '未配置' },

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setApiKey: (apiKey) => set({ apiKey }),
  setBaseURL: (baseURL) => set({ baseURL }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  loadConfig: async () => {
    try {
      const config = await window.electronAPI.configLoad();
      if (config && Object.keys(config).length > 0) {
        const provider = (config.provider as Provider) || 'anthropic';
        const model = config.model || '';
        const baseURL = config.baseURL || '';
        let apiKey = '';

        set({ provider, model, baseURL });

        if (config.apiKey) {
          try {
            apiKey = await window.electronAPI.decryptData(config.apiKey);
            set({ apiKey });
          } catch {
            console.warn('Failed to decrypt API key');
          }
        }

        // 初始化后端服务配置
        if (apiKey) {
          await window.electronAPI.setModelConfig({
            provider,
            model,
            baseURL: baseURL || undefined,
            apiKey,
          });
          set({ connectionStatus: { connected: true, message: '已配置' } });
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  },

  saveConfig: async () => {
    const { provider, model, apiKey, baseURL } = get();
    try {
      let encryptedKey = '';
      if (apiKey) {
        encryptedKey = await window.electronAPI.encryptData(apiKey);
      }

      await window.electronAPI.configSave({
        provider,
        model,
        baseURL: baseURL || undefined,
        apiKey: encryptedKey,
      });

      await window.electronAPI.setModelConfig({
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
      await window.electronAPI.setModelConfig({
        provider,
        model,
        apiKey,
        baseURL: baseURL || undefined,
      });

      const result = await window.electronAPI.testConnection();
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
