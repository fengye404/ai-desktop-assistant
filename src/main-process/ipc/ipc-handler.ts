import { ipcMain } from 'electron';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (...args: any[]) => Promise<unknown> | unknown;

export function handleIpc(channel: string, handler: HandlerFn): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`[ipc:${channel}] Error:`, error);
      throw error;
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listenIpc(channel: string, handler: (...args: any[]) => void): void {
  ipcMain.on(channel, (_event, ...args) => {
    try {
      handler(...args);
    } catch (error) {
      console.error(`[ipc:${channel}] Error:`, error);
    }
  });
}
