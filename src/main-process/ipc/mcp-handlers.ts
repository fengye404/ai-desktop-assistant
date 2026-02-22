import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { McpServerConfig } from '../../types';
import type { MainProcessContext } from '../main-process-context';

export function registerMcpHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_SERVERS, async () => {
    return context.listMcpServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_LIST_TOOLS, async () => {
    return context.listMcpTools();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REFRESH, async () => {
    return context.refreshMcp();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_UPSERT_SERVER, async (_event, name: string, config: McpServerConfig) => {
    return context.upsertMcpServer(name, config);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE_SERVER, async (_event, name: string) => {
    return context.removeMcpServer(name);
  });
}
