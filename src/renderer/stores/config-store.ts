import { create } from 'zustand';
import type { ModelServiceInstance, Provider } from '../../types';
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

type ModelInstanceState = Omit<ModelServiceInstance, 'baseURL'> & { baseURL: string };

interface ConfigState {
  instances: ModelInstanceState[];
  activeInstanceId: string | null;
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string;
  allowedTools: string[];
  sessionAllowedTools: string[];
  allowAllForSession: boolean;
  isSettingsOpen: boolean;
  connectionStatus: { connected: boolean; message: string };

  setActiveInstance: (id: string) => void;
  createInstance: () => void;
  removeInstance: (id: string) => void;
  renameInstance: (id: string, name: string) => void;
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

function createInstanceId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProvider(provider: unknown): Provider {
  return provider === 'anthropic' ? 'anthropic' : 'openai';
}

function getDefaultModel(provider: Provider): string {
  return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
}

function createDefaultInstance(name: string, provider: Provider = 'anthropic'): ModelInstanceState {
  return {
    id: createInstanceId(),
    name,
    provider,
    model: getDefaultModel(provider),
    apiKey: '',
    baseURL: '',
  };
}

function buildNextInstanceName(instances: ModelInstanceState[]): string {
  let index = instances.length + 1;
  while (instances.some((item) => item.name === `实例 ${index}`)) {
    index += 1;
  }
  return `实例 ${index}`;
}

function pickActiveInstance(
  instances: ModelInstanceState[],
  activeInstanceId: string | null,
): ModelInstanceState | undefined {
  if (!instances.length) {
    return undefined;
  }
  return instances.find((item) => item.id === activeInstanceId) ?? instances[0];
}

function toEditableState(instance: ModelInstanceState | undefined): {
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string;
} {
  if (!instance) {
    return {
      provider: 'anthropic',
      model: getDefaultModel('anthropic'),
      apiKey: '',
      baseURL: '',
    };
  }

  return {
    provider: instance.provider,
    model: instance.model,
    apiKey: instance.apiKey,
    baseURL: instance.baseURL,
  };
}

function updateActiveInstance(
  state: ConfigState,
  patch: (instance: ModelInstanceState) => ModelInstanceState,
): Pick<ConfigState, 'instances' | 'provider' | 'model' | 'apiKey' | 'baseURL'> {
  const activeInstance = pickActiveInstance(state.instances, state.activeInstanceId);
  if (!activeInstance) {
    const editable = toEditableState(undefined);
    return {
      instances: state.instances,
      ...editable,
    };
  }

  const instances = state.instances.map((item) => (item.id === activeInstance.id ? patch(item) : item));
  const nextActive = pickActiveInstance(instances, activeInstance.id);
  const editable = toEditableState(nextActive);

  return {
    instances,
    ...editable,
  };
}

const initialInstance = createDefaultInstance('默认实例', 'anthropic');

export const useConfigStore = create<ConfigState>((set, get) => ({
  instances: [initialInstance],
  activeInstanceId: initialInstance.id,
  provider: initialInstance.provider,
  model: initialInstance.model,
  apiKey: initialInstance.apiKey,
  baseURL: initialInstance.baseURL,
  allowedTools: DEFAULT_ALLOWED_TOOLS,
  sessionAllowedTools: [],
  allowAllForSession: false,
  isSettingsOpen: false,
  connectionStatus: { connected: false, message: '未配置' },

  setActiveInstance: (id) => set((state) => {
    const activeInstance = state.instances.find((item) => item.id === id);
    if (!activeInstance) {
      return state;
    }

    return {
      activeInstanceId: id,
      ...toEditableState(activeInstance),
      connectionStatus: {
        connected: Boolean(activeInstance.model.trim() && activeInstance.apiKey.trim()),
        message: activeInstance.model.trim() && activeInstance.apiKey.trim() ? '已配置' : '未配置',
      },
    };
  }),

  createInstance: () => set((state) => {
    const newInstance = createDefaultInstance(buildNextInstanceName(state.instances), state.provider);
    return {
      instances: [...state.instances, newInstance],
      activeInstanceId: newInstance.id,
      ...toEditableState(newInstance),
      connectionStatus: { connected: false, message: '未配置' },
    };
  }),

  removeInstance: (id) => set((state) => {
    if (!state.instances.some((item) => item.id === id)) {
      return state;
    }

    let instances = state.instances.filter((item) => item.id !== id);
    if (instances.length === 0) {
      instances = [createDefaultInstance('默认实例', 'anthropic')];
    }

    const activeInstanceId = state.activeInstanceId === id ? instances[0].id : state.activeInstanceId;
    const activeInstance = pickActiveInstance(instances, activeInstanceId);
    const editable = toEditableState(activeInstance);
    const hasCredentials = Boolean(activeInstance?.model.trim() && activeInstance.apiKey.trim());

    return {
      instances,
      activeInstanceId: activeInstance?.id ?? null,
      ...editable,
      connectionStatus: {
        connected: hasCredentials,
        message: hasCredentials ? '已配置' : '未配置',
      },
    };
  }),

  renameInstance: (id, name) => set((state) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return state;
    }

    const instances = state.instances.map((item) => (item.id === id ? { ...item, name: trimmedName } : item));
    return { instances };
  }),

  setProvider: (provider) => set((state) => {
    return updateActiveInstance(state, (instance) => {
      const nextModel = instance.model.trim() ? instance.model : getDefaultModel(provider);
      return {
        ...instance,
        provider,
        model: nextModel,
        baseURL: provider === 'anthropic' ? '' : instance.baseURL,
      };
    });
  }),

  setModel: (model) => set((state) => updateActiveInstance(state, (instance) => ({ ...instance, model }))),

  setApiKey: (apiKey) => set((state) => updateActiveInstance(state, (instance) => ({ ...instance, apiKey }))),

  setBaseURL: (baseURL) => set((state) => updateActiveInstance(state, (instance) => ({ ...instance, baseURL }))),

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
      const loadedInstances = await Promise.all(
        config.instances.map(async (item, index) => {
          const provider = normalizeProvider(item.provider);
          let apiKey = item.apiKey || '';

          if (apiKey) {
            try {
              apiKey = await electronApiClient.decryptData(apiKey);
            } catch {
              console.warn(`Failed to decrypt API key for instance ${item.id}`);
              apiKey = '';
            }
          }

          const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createInstanceId();
          const model = typeof item.model === 'string' && item.model.trim()
            ? item.model.trim()
            : getDefaultModel(provider);
          const name = typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : `实例 ${index + 1}`;
          const baseURL = typeof item.baseURL === 'string' ? item.baseURL : '';

          return {
            id,
            name,
            provider,
            model,
            apiKey,
            baseURL,
          } satisfies ModelInstanceState;
        }),
      );

      const instances = loadedInstances.length > 0
        ? loadedInstances
        : [createDefaultInstance('默认实例', 'anthropic')];
      const activeInstance = pickActiveInstance(instances, config.activeInstanceId);

      set({
        instances,
        activeInstanceId: activeInstance?.id ?? null,
        ...toEditableState(activeInstance),
      });

      if (activeInstance) {
        await electronApiClient.setModelConfig({
          provider: activeInstance.provider,
          model: activeInstance.model,
          baseURL: activeInstance.baseURL || undefined,
          apiKey: activeInstance.apiKey,
        });
      }

      if (activeInstance && activeInstance.model.trim() && activeInstance.apiKey.trim()) {
        set({ connectionStatus: { connected: true, message: '已配置' } });
      } else {
        set({ connectionStatus: { connected: false, message: '未配置' } });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  },

  saveConfig: async () => {
    const { instances, activeInstanceId, allowedTools } = get();
    const activeInstance = pickActiveInstance(instances, activeInstanceId);

    try {
      const encryptedInstances = await Promise.all(
        instances.map(async (instance) => {
          let encryptedKey = '';
          if (instance.apiKey) {
            encryptedKey = await electronApiClient.encryptData(instance.apiKey);
          }

          return {
            ...instance,
            apiKey: encryptedKey,
            baseURL: instance.baseURL || undefined,
          };
        }),
      );

      localStorage.setItem('allowedTools', JSON.stringify(allowedTools));

      await electronApiClient.configSave({
        activeInstanceId: activeInstance?.id ?? null,
        instances: encryptedInstances,
      });

      if (activeInstance) {
        await electronApiClient.setModelConfig({
          provider: activeInstance.provider,
          model: activeInstance.model,
          baseURL: activeInstance.baseURL || undefined,
          apiKey: activeInstance.apiKey,
        });
      }

      set({
        connectionStatus: {
          connected: Boolean(activeInstance?.model.trim() && activeInstance.apiKey.trim()),
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
