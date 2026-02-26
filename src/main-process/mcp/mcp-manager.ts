/**
 * MCP Configuration Manager — pure config management for MCP servers.
 *
 * After the Agent SDK migration, the SDK handles MCP server connections
 * and tool routing internally. This manager only:
 * - Stores/retrieves MCP server configurations
 * - Provides config to AgentService for SDK `mcpServers` option
 * - Exposes server status from the SDK query interface
 */

import type {
  McpServerConfig,
  McpServersConfig,
  McpServerStatus,
  McpToolInfo,
  McpRefreshResult,
} from '../../types';

export class McpManager {
  private servers: McpServersConfig = {};

  constructor(_workspaceRoot: string) {}

  setServers(config: McpServersConfig): void {
    this.servers = { ...config };
  }

  getServerConfig(): McpServersConfig {
    return { ...this.servers };
  }

  upsertServer(name: string, config: McpServerConfig): void {
    this.servers[name] = config;
  }

  removeServer(name: string): void {
    delete this.servers[name];
  }

  /**
   * Build a status list from the current config.
   * Actual connection status comes from the SDK query interface at runtime.
   */
  listServerStatus(): McpServerStatus[] {
    return Object.entries(this.servers).map(([name, config]) => ({
      name,
      transport: config.transport ?? 'stdio',
      enabled: config.enabled !== false,
      connected: false,
      toolCount: 0,
      command: config.command,
      args: config.args,
      url: config.url,
    }));
  }

  listToolInfo(): McpToolInfo[] {
    return [];
  }

  async refresh(): Promise<McpRefreshResult> {
    return {
      servers: this.listServerStatus(),
      tools: [],
    };
  }

  dispose(): void {
    this.servers = {};
  }
}
