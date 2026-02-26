import { ipcMain } from 'electron';
import type { ToolApprovalResponse } from '../../types';
import { IPC_CHANNELS } from '../../types';
import type { MainProcessContext } from '../main-process-context';

export function registerToolApprovalHandlers(context: MainProcessContext): void {
  ipcMain.on(IPC_CHANNELS.TOOL_APPROVAL_RESPONSE, (_event, response: ToolApprovalResponse) => {
    context.toolApproval.respond(response);
  });
}
