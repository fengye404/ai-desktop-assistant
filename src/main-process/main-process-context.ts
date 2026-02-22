import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { ClaudeService } from '../claude-service';
import { SessionStorage } from '../session-storage';
import type {
  McpRefreshResult,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
  PathAutocompleteItem,
  ToolApprovalRequest,
} from '../types';
import { ServiceNotInitializedError } from '../utils/errors';
import { ToolApprovalCoordinator } from './tool-approval-coordinator';
import { FileReferenceResolver, type ResolvedUserMessage } from './chat-input/file-reference-resolver';
import { PathAutocompleteService } from './chat-input/path-autocomplete';
import { McpManager } from './mcp/mcp-manager';

function buildApprovalDescription(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
}

function hasPackageJson(targetPath: string): boolean {
  return fs.existsSync(path.join(targetPath, 'package.json'));
}

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.INIT_CWD,
    process.cwd(),
    app.getAppPath(),
  ].filter((value): value is string => Boolean(value))
    .map((value) => path.resolve(value));

  for (const candidate of candidates) {
    if (hasPackageJson(candidate)) {
      if (path.basename(candidate) === 'dist') {
        const parent = path.dirname(candidate);
        if (hasPackageJson(parent)) {
          return parent;
        }
      }
      return candidate;
    }
  }

  return path.resolve(process.cwd());
}

/**
 * Holds runtime objects for main process and provides safe access helpers.
 */
export class MainProcessContext {
  private mainWindow: BrowserWindow | null = null;
  private claudeService: ClaudeService | null = null;
  private sessionStorage: SessionStorage | null = null;
  private readonly workspaceRoot = resolveWorkspaceRoot();
  private readonly fileReferenceResolver = new FileReferenceResolver(this.workspaceRoot);
  private readonly pathAutocompleteService = new PathAutocompleteService(this.workspaceRoot);
  private readonly mcpManager = new McpManager(this.workspaceRoot);

  readonly toolApproval = new ToolApprovalCoordinator(() => this.mainWindow);

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  async initializeServices(): Promise<void> {
    this.sessionStorage = new SessionStorage();
    this.claudeService = new ClaudeService(this.sessionStorage);
    this.claudeService.setWorkingDirectory(this.workspaceRoot);

    this.claudeService.setToolPermissionCallback(async (toolName, input) => {
      const request: ToolApprovalRequest = {
        tool: toolName,
        input,
        description: buildApprovalDescription(input),
      };
      return this.toolApproval.requestApproval(request);
    });

    this.ensureInitialSession();
    await this.initializeMcp();
  }

  cleanup(): void {
    this.toolApproval.dispose();
    this.mcpManager.dispose();
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

  resolveUserMessage(message: string): ResolvedUserMessage {
    return this.fileReferenceResolver.resolve(message);
  }

  autocompletePaths(partialPath: string): PathAutocompleteItem[] {
    return this.pathAutocompleteService.suggest(partialPath);
  }

  listMcpServers(): McpServerStatus[] {
    return this.mcpManager.listServerStatus();
  }

  listMcpTools(): McpToolInfo[] {
    return this.mcpManager.listToolInfo();
  }

  async refreshMcp(): Promise<McpRefreshResult> {
    const result = await this.mcpManager.refresh();
    this.syncMcpToolsToClaudeService();
    return result;
  }

  async upsertMcpServer(name: string, config: McpServerConfig): Promise<McpRefreshResult> {
    const storage = this.getSessionStorageOrThrow();
    const nextConfig = this.mcpManager.getServerConfigSnapshot();
    nextConfig[name] = config;
    storage.saveMcpServers(nextConfig);

    this.mcpManager.setServers(nextConfig);
    const result = await this.mcpManager.refresh();
    this.syncMcpToolsToClaudeService();
    return result;
  }

  async removeMcpServer(name: string): Promise<McpRefreshResult> {
    const storage = this.getSessionStorageOrThrow();
    const nextConfig = this.mcpManager.getServerConfigSnapshot();
    delete nextConfig[name];
    storage.saveMcpServers(nextConfig);

    this.mcpManager.setServers(nextConfig);
    const result = await this.mcpManager.refresh();
    this.syncMcpToolsToClaudeService();
    return result;
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

  private async initializeMcp(): Promise<void> {
    const storage = this.getSessionStorageOrThrow();
    const configuredServers = storage.loadMcpServers();
    this.mcpManager.setServers(configuredServers);

    try {
      await this.mcpManager.refresh();
      this.syncMcpToolsToClaudeService();
    } catch (error) {
      console.error('[mcp] initialize failed:', error);
    }
  }

  private syncMcpToolsToClaudeService(): void {
    const service = this.getClaudeServiceOrThrow();
    service.setDynamicTools(this.mcpManager.getDynamicTools());
  }
}
