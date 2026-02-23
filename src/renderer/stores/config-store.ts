import { create } from 'zustand';
import type { ModelProvider, Provider } from '../../types';
import { electronApiClient } from '@/services/electron-api-client';

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
  providers: ModelProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;

  // Derived from active selection
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string;

  allowedTools: string[];
  sessionAllowedTools: string[];
  allowAllForSession: boolean;
  isSettingsOpen: boolean;
  connectionStatus: { connected: boolean; message: string };

  // Provider CRUD
  addProvider: (provider: ModelProvider) => void;
  updateProvider: (id: string, patch: Partial<Omit<ModelProvider, 'id'>>) => void;
  removeProvider: (id: string) => void;
  addModelToProvider: (providerId: string, modelId: string) => void;
  removeModelFromProvider: (providerId: string, modelId: string) => void;

  // Active selection
  setActiveModel: (providerId: string, modelId: string) => void;
  setModel: (model: string) => void;

  // Tools
  setAllowedTools: (tools: string[]) => void;
  toggleTool: (tool: string) => void;
  allowToolForSession: (tool: string) => void;
  setAllowAllForSession: (allow: boolean) => void;
  clearSessionAllowedTools: () => void;

  // UI
  setSettingsOpen: (open: boolean) => void;
  setConnectionStatus: (status: { connected: boolean; message: string }) => void;
  isToolAllowed: (tool: string) => boolean;

  // Persistence
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  testConnection: () => Promise<void>;
}

const DEFAULT_ALLOWED_TOOLS = ALL_TOOLS
  .filter((tool) => tool.defaultAllowed)
  .map((tool) => tool.name);

function deriveModelConfig(providers: ModelProvider[], activeProviderId: string | null, activeModelId: string | null) {
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  if (!activeProvider) {
    return { provider: 'openai' as Provider, model: '', apiKey: '', baseURL: '' };
  }

  return {
    provider: activeProvider.protocol,
    model: activeModelId || '',
    apiKey: activeProvider.apiKey,
    baseURL: activeProvider.baseURL || '',
  };
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  provider: 'openai',
  model: '',
  apiKey: '',
  baseURL: '',
  allowedTools: DEFAULT_ALLOWED_TOOLS,
  sessionAllowedTools: [],
  allowAllForSession: false,
  isSettingsOpen: false,
  connectionStatus: { connected: false, message: '未配置' },

  addProvider: (provider) => set((state) => {
    const providers = [...state.providers, provider];
    const isFirst = state.providers.length === 0;
    const activeProviderId = isFirst ? provider.id : state.activeProviderId;
    const activeModelId = isFirst && provider.models.length > 0 ? provider.models[0] : state.activeModelId;
    const derived = deriveModelConfig(providers, activeProviderId, activeModelId);
    return { providers, activeProviderId, activeModelId, ...derived };
  }),

  updateProvider: (id, patch) => set((state) => {
    const providers = state.providers.map((p) =>
      p.id === id ? { ...p, ...patch } : p
    );
    const derived = deriveModelConfig(providers, state.activeProviderId, state.activeModelId);
    return { providers, ...derived };
  }),

  removeProvider: (id) => set((state) => {
    const providers = state.providers.filter((p) => p.id !== id);
    let { activeProviderId, activeModelId } = state;

    if (activeProviderId === id) {
      activeProviderId = providers[0]?.id ?? null;
      const newProvider = providers.find((p) => p.id === activeProviderId);
      activeModelId = newProvider?.models[0] ?? null;
    }

    const derived = deriveModelConfig(providers, activeProviderId, activeModelId);
    const hasCredentials = Boolean(derived.model.trim() && derived.apiKey.trim());
    return {
      providers,
      activeProviderId,
      activeModelId,
      ...derived,
      connectionStatus: { connected: hasCredentials, message: hasCredentials ? '已配置' : '未配置' },
    };
  }),

  addModelToProvider: (providerId, modelId) => set((state) => {
    const trimmed = modelId.trim();
    if (!trimmed) return state;

    const providers = state.providers.map((p) => {
      if (p.id !== providerId) return p;
      if (p.models.includes(trimmed)) return p;
      return { ...p, models: [...p.models, trimmed] };
    });

    return { providers };
  }),

  removeModelFromProvider: (providerId, modelId) => set((state) => {
    const providers = state.providers.map((p) => {
      if (p.id !== providerId) return p;
      return { ...p, models: p.models.filter((m) => m !== modelId) };
    });

    let { activeModelId } = state;
    if (activeModelId === modelId && state.activeProviderId === providerId) {
      const provider = providers.find((p) => p.id === providerId);
      activeModelId = provider?.models[0] ?? null;
    }

    const derived = deriveModelConfig(providers, state.activeProviderId, activeModelId);
    return { providers, activeModelId, ...derived };
  }),

  setActiveModel: (providerId, modelId) => set((state) => {
    const derived = deriveModelConfig(state.providers, providerId, modelId);
    const hasCredentials = Boolean(derived.model.trim() && derived.apiKey.trim());
    return {
      activeProviderId: providerId,
      activeModelId: modelId,
      ...derived,
      connectionStatus: { connected: hasCredentials, message: hasCredentials ? '已配置' : '未配置' },
    };
  }),

  setModel: (model) => set((state) => {
    if (!state.activeProviderId) return state;

    const providers = state.providers.map((p) => {
      if (p.id !== state.activeProviderId) return p;
      if (!p.models.includes(model)) {
        return { ...p, models: [...p.models, model] };
      }
      return p;
    });

    const derived = deriveModelConfig(providers, state.activeProviderId, model);
    return { providers, activeModelId: model, ...derived };
  }),

  setAllowedTools: (tools) => set({ allowedTools: tools }),

  toggleTool: (tool) => set((state) => ({
    allowedTools: state.allowedTools.includes(tool)
      ? state.allowedTools.filter((t) => t !== tool)
      : [...state.allowedTools, tool],
  })),

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
      const loadedProviders = await Promise.all(
        config.providers.map(async (p) => {
          let apiKey = p.apiKey || '';
          if (apiKey) {
            try {
              apiKey = await electronApiClient.decryptData(apiKey);
            } catch {
              console.warn(`Failed to decrypt API key for provider ${p.id}`);
              apiKey = '';
            }
          }

          return {
            id: p.id,
            name: p.name || '未命名供应商',
            description: p.description || '',
            protocol: (p.protocol === 'anthropic' ? 'anthropic' : 'openai') as Provider,
            baseURL: p.baseURL || undefined,
            apiKey,
            models: p.models || [],
          } satisfies ModelProvider;
        }),
      );

      const providers = loadedProviders;
      const activeProviderId = config.activeProviderId && providers.some((p) => p.id === config.activeProviderId)
        ? config.activeProviderId
        : providers[0]?.id ?? null;
      const activeModelId = config.activeModelId || null;

      const derived = deriveModelConfig(providers, activeProviderId, activeModelId);

      set({
        providers,
        activeProviderId,
        activeModelId,
        ...derived,
      });

      if (derived.model.trim() && derived.apiKey.trim()) {
        await electronApiClient.setModelConfig({
          provider: derived.provider,
          model: derived.model,
          baseURL: derived.baseURL || undefined,
          apiKey: derived.apiKey,
        });
        set({ connectionStatus: { connected: true, message: '已配置' } });
      } else {
        set({ connectionStatus: { connected: false, message: '未配置' } });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  },

  saveConfig: async () => {
    const { providers, activeProviderId, activeModelId, allowedTools } = get();
    const derived = deriveModelConfig(providers, activeProviderId, activeModelId);

    try {
      const encryptedProviders = await Promise.all(
        providers.map(async (p) => {
          let encryptedKey = '';
          if (p.apiKey) {
            encryptedKey = await electronApiClient.encryptData(p.apiKey);
          }
          return { ...p, apiKey: encryptedKey };
        }),
      );

      localStorage.setItem('allowedTools', JSON.stringify(allowedTools));

      await electronApiClient.configSave({
        activeProviderId,
        activeModelId,
        providers: encryptedProviders,
      });

      if (derived.model.trim() && derived.apiKey.trim()) {
        await electronApiClient.setModelConfig({
          provider: derived.provider,
          model: derived.model,
          baseURL: derived.baseURL || undefined,
          apiKey: derived.apiKey,
        });
      }

      set({
        connectionStatus: {
          connected: Boolean(derived.model.trim() && derived.apiKey.trim()),
          message: '已保存',
        },
        isSettingsOpen: false,
      });
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
