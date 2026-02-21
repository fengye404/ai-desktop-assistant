import type { BrowserWindow } from 'electron';
import { ClaudeService } from '../claude-service';
import { SessionStorage } from '../session-storage';
import type { ToolApprovalRequest } from '../types';
import { ServiceNotInitializedError } from '../utils/errors';
import { ToolApprovalCoordinator } from './tool-approval-coordinator';

function buildApprovalDescription(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
}

/**
 * Holds runtime objects for main process and provides safe access helpers.
 */
export class MainProcessContext {
  private mainWindow: BrowserWindow | null = null;
  private claudeService: ClaudeService | null = null;
  private sessionStorage: SessionStorage | null = null;

  readonly toolApproval = new ToolApprovalCoordinator(() => this.mainWindow);

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  initializeServices(): void {
    this.sessionStorage = new SessionStorage();
    this.claudeService = new ClaudeService(this.sessionStorage);

    this.claudeService.setToolPermissionCallback(async (toolName, input) => {
      const request: ToolApprovalRequest = {
        tool: toolName,
        input,
        description: buildApprovalDescription(input),
      };
      return this.toolApproval.requestApproval(request);
    });

    this.ensureInitialSession();
  }

  cleanup(): void {
    this.toolApproval.dispose();
    this.claudeService?.cleanup();
    this.claudeService = null;
    this.sessionStorage = null;
    this.mainWindow = null;
  }

  getClaudeServiceOrThrow(): ClaudeService {
    if (!this.claudeService) {
      throw new ServiceNotInitializedError('Claude service');
    }
    return this.claudeService;
  }

  getSessionStorageOrThrow(): SessionStorage {
    if (!this.sessionStorage) {
      throw new ServiceNotInitializedError('Session storage');
    }
    return this.sessionStorage;
  }

  private ensureInitialSession(): void {
    const storage = this.getSessionStorageOrThrow();
    const sessions = storage.listSessions();

    if (sessions.length === 0) {
      storage.createSession();
      return;
    }

    storage.switchSession(sessions[0].id);
  }
}
