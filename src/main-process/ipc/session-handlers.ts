import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { MainProcessContext } from '../main-process-context';

export function registerSessionHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
    const storage = context.getSessionStorageOrThrow();
    return storage.listSessions();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_event, id: string) => {
    const storage = context.getSessionStorageOrThrow();
    return storage.getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_event, title?: string) => {
    const storage = context.getSessionStorageOrThrow();
    return storage.createSession(title);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string) => {
    const storage = context.getSessionStorageOrThrow();
    return storage.deleteSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, async (_event, id: string) => {
    const storage = context.getSessionStorageOrThrow();
    return storage.switchSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, async (_event, id: string, title: string) => {
    const storage = context.getSessionStorageOrThrow();
    return storage.renameSession(id, title);
  });
}
