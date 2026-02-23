import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { ModelConfig, ModelServicesConfig } from '../../types';
import type { MainProcessContext } from '../main-process-context';

function isModelServicesConfig(payload: unknown): payload is ModelServicesConfig {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const maybePayload = payload as Partial<ModelServicesConfig>;
  return Array.isArray(maybePayload.instances);
}

export function registerConfigHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_event, config: ModelServicesConfig | Partial<ModelConfig>) => {
    const storage = context.getSessionStorageOrThrow();

    if (isModelServicesConfig(config)) {
      storage.saveModelServicesConfig(config);
    } else {
      storage.saveConfig(config);
    }

    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LOAD, async () => {
    const storage = context.getSessionStorageOrThrow();
    return storage.loadModelServicesConfig();
  });
}
