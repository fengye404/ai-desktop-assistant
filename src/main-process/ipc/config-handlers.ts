import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { ModelConfig } from '../../types';
import type { MainProcessContext } from '../main-process-context';

export function registerConfigHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_event, config: Partial<ModelConfig>) => {
    const storage = context.getSessionStorageOrThrow();
    storage.saveConfig(config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LOAD, async () => {
    const storage = context.getSessionStorageOrThrow();
    return storage.loadConfig();
  });
}
