import type { MainProcessContext } from '../main-process-context';
import { registerChatHandlers } from './chat-handlers';
import { registerSessionHandlers } from './session-handlers';
import { registerConfigHandlers } from './config-handlers';
import { registerSecurityHandlers } from './security-handlers';
import { registerToolApprovalHandlers } from './tool-approval-handlers';
import { registerMcpHandlers } from './mcp-handlers';

export function registerIpcHandlers(context: MainProcessContext): void {
  registerToolApprovalHandlers(context);
  registerChatHandlers(context);
  registerSessionHandlers(context);
  registerConfigHandlers(context);
  registerMcpHandlers(context);
  registerSecurityHandlers();
}
