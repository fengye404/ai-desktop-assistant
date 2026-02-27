export type McpServerTransport = 'stdio' | 'streamable-http' | 'sse';

export interface McpServerConfig {
  transport?: McpServerTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  cwd?: string;
  url?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export type McpServersConfig = Record<string, McpServerConfig>;

export interface McpServerStatus {
  name: string;
  transport: McpServerTransport;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
  lastError?: string;
  command?: string;
  args?: string[];
  url?: string;
}

export interface McpToolInfo {
  alias: string;
  originalName: string;
  server: string;
  description: string;
}

export interface McpRefreshResult {
  servers: McpServerStatus[];
  tools: McpToolInfo[];
}
