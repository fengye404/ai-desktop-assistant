import type {
  McpRefreshResult,
  McpServerConfig,
  McpServerStatus,
  McpServersConfig,
  McpToolInfo,
  McpServerTransport,
  ToolDefinition,
  ToolResult,
} from '../../types';
import type { DynamicToolRegistration } from '../../tool-executor';
import { McpStdIoClient, type McpToolDescriptor } from './mcp-stdio-client';
import { McpStreamableHttpClient } from './mcp-streamable-http-client';
import { McpSseClient } from './mcp-sse-client';

interface McpTransportClient {
  start: () => Promise<void>;
  stop: () => void;
  listTools: (forceRefresh?: boolean) => Promise<McpToolDescriptor[]>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ isError: boolean; output: string }>;
}

interface McpRuntime {
  name: string;
  config: RequiredMcpServerConfig;
  client: McpTransportClient | null;
  connected: boolean;
  tools: McpToolDescriptor[];
  lastError?: string;
}

interface ToolRoute {
  serverName: string;
  serverToolName: string;
}

interface RequiredMcpServerConfig {
  transport: McpServerTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
  cwd?: string;
  url?: string;
  enabled: boolean;
  timeoutMs: number;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeServerConfig(config: McpServerConfig): RequiredMcpServerConfig {
  const rawTransport = config.transport as string | undefined;
  let normalizedTransport: McpServerTransport = 'stdio';
  if (rawTransport === 'sse') {
    normalizedTransport = 'sse';
  } else if (rawTransport === 'streamable-http' || rawTransport === 'http') {
    normalizedTransport = 'streamable-http';
  }

  return {
    transport: normalizedTransport,
    command: typeof config.command === 'string' ? config.command.trim() : '',
    args: Array.isArray(config.args)
      ? config.args.filter((item): item is string => typeof item === 'string')
      : [],
    env: config.env && typeof config.env === 'object'
      ? Object.fromEntries(
        Object.entries(config.env)
          .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
      )
      : {},
    headers: config.headers && typeof config.headers === 'object'
      ? Object.fromEntries(
        Object.entries(config.headers)
          .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
      )
      : {},
    cwd: typeof config.cwd === 'string' && config.cwd.trim() ? config.cwd.trim() : undefined,
    url: typeof config.url === 'string' && config.url.trim() ? config.url.trim() : undefined,
    enabled: config.enabled !== false,
    timeoutMs: typeof config.timeoutMs === 'number' && Number.isFinite(config.timeoutMs)
      ? Math.max(1000, Math.min(config.timeoutMs, 120000))
      : 20000,
  };
}

function cloneServerConfig(config: RequiredMcpServerConfig): McpServerConfig {
  return {
    transport: config.transport,
    command: config.command,
    args: [...config.args],
    env: { ...config.env },
    headers: { ...config.headers },
    cwd: config.cwd,
    url: config.url,
    enabled: config.enabled,
    timeoutMs: config.timeoutMs,
  };
}

function sanitizeIdentifier(value: string, maxLength: number): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safe = normalized || 'tool';
  return safe.slice(0, maxLength);
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function normalizeInputSchema(inputSchema: unknown): ToolDefinition['input_schema'] {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return {
      type: 'object',
      properties: {},
    };
  }

  const source = inputSchema as Record<string, unknown>;
  const rawProperties = (source.properties && typeof source.properties === 'object')
    ? source.properties as Record<string, unknown>
    : {};
  const properties: ToolDefinition['input_schema']['properties'] = {};

  for (const [key, rawProperty] of Object.entries(rawProperties)) {
    if (!rawProperty || typeof rawProperty !== 'object') {
      properties[key] = { type: 'string', description: '' };
      continue;
    }

    const property = rawProperty as Record<string, unknown>;
    const rawEnum = Array.isArray(property.enum)
      ? property.enum.filter((value): value is string => typeof value === 'string')
      : undefined;

    properties[key] = {
      type: typeof property.type === 'string' ? property.type : 'string',
      description: typeof property.description === 'string' ? property.description : '',
      ...(rawEnum && rawEnum.length > 0 ? { enum: rawEnum } : {}),
    };
  }

  const required = Array.isArray(source.required)
    ? source.required.filter((value): value is string => typeof value === 'string')
    : undefined;

  return {
    type: 'object',
    properties,
    ...(required && required.length > 0 ? { required } : {}),
  };
}

export class McpManager {
  private readonly workspaceRoot: string;
  private readonly runtimes = new Map<string, McpRuntime>();
  private readonly toolRoutes = new Map<string, ToolRoute>();
  private dynamicTools: DynamicToolRegistration[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  dispose(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.client?.stop();
    }
    this.runtimes.clear();
    this.dynamicTools = [];
    this.toolRoutes.clear();
  }

  setServers(config: McpServersConfig): void {
    const nextConfigs = new Map<string, RequiredMcpServerConfig>();
    for (const [name, value] of Object.entries(config)) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;
      nextConfigs.set(trimmedName, normalizeServerConfig(value));
    }

    for (const [existingName, runtime] of this.runtimes.entries()) {
      if (!nextConfigs.has(existingName)) {
        runtime.client?.stop();
        this.runtimes.delete(existingName);
      }
    }

    for (const [name, normalizedConfig] of nextConfigs.entries()) {
      const runtime = this.runtimes.get(name);
      if (!runtime) {
        this.runtimes.set(name, {
          name,
          config: normalizedConfig,
          client: null,
          connected: false,
          tools: [],
        });
        continue;
      }

      const configChanged = JSON.stringify(runtime.config) !== JSON.stringify(normalizedConfig);
      runtime.config = normalizedConfig;
      if (configChanged) {
        runtime.client?.stop();
        runtime.client = null;
        runtime.connected = false;
        runtime.tools = [];
      }
    }

    this.rebuildDynamicTools();
  }

  getServerConfigSnapshot(): McpServersConfig {
    const result: McpServersConfig = {};
    for (const runtime of this.runtimes.values()) {
      result[runtime.name] = cloneServerConfig(runtime.config);
    }
    return result;
  }

  async refresh(): Promise<McpRefreshResult> {
    for (const runtime of this.runtimes.values()) {
      if (!runtime.config.enabled) {
        runtime.client?.stop();
        runtime.client = null;
        runtime.connected = false;
        runtime.tools = [];
        runtime.lastError = undefined;
        continue;
      }

      if (runtime.config.transport !== 'stdio') {
        if (!runtime.config.url) {
          runtime.connected = false;
          runtime.tools = [];
          runtime.lastError = `Missing MCP URL for ${runtime.config.transport}`;
          continue;
        }
      } else {
        if (!runtime.config.command) {
          runtime.connected = false;
          runtime.tools = [];
          runtime.lastError = 'Missing MCP command';
          continue;
        }
      }

      try {
        const client = runtime.client ?? this.createClient(runtime);
        runtime.client = client;
        await client.start();
        runtime.tools = await client.listTools(true);
        runtime.connected = true;
        runtime.lastError = undefined;
      } catch (error) {
        runtime.connected = false;
        runtime.tools = [];
        runtime.lastError = toErrorMessage(error);
        runtime.client?.stop();
        runtime.client = null;
      }
    }

    this.rebuildDynamicTools();
    return this.buildRefreshResult();
  }

  listServerStatus(): McpServerStatus[] {
    const result: McpServerStatus[] = [];
    for (const runtime of this.runtimes.values()) {
      result.push({
        name: runtime.name,
        transport: runtime.config.transport,
        enabled: runtime.config.enabled,
        connected: runtime.connected,
        toolCount: runtime.tools.length,
        lastError: runtime.lastError,
        command: runtime.config.command,
        args: [...runtime.config.args],
        url: runtime.config.url,
      });
    }

    result.sort((left, right) => left.name.localeCompare(right.name));
    return result;
  }

  listToolInfo(): McpToolInfo[] {
    return this.dynamicTools
      .map((registration) => {
        const route = this.toolRoutes.get(registration.definition.name);
        if (!route) {
          return null;
        }
        const description = registration.definition.description;
        return {
          alias: registration.definition.name,
          originalName: route.serverToolName,
          server: route.serverName,
          description,
        } satisfies McpToolInfo;
      })
      .filter((item): item is McpToolInfo => item !== null)
      .sort((left, right) => left.alias.localeCompare(right.alias));
  }

  getDynamicTools(): DynamicToolRegistration[] {
    return this.dynamicTools;
  }

  private buildRefreshResult(): McpRefreshResult {
    return {
      servers: this.listServerStatus(),
      tools: this.listToolInfo(),
    };
  }

  private createClient(runtime: McpRuntime): McpTransportClient {
    if (runtime.config.transport === 'stdio') {
      return new McpStdIoClient({
        command: runtime.config.command,
        args: runtime.config.args,
        env: runtime.config.env,
        cwd: runtime.config.cwd,
        timeoutMs: runtime.config.timeoutMs,
        workspaceRoot: this.workspaceRoot,
      });
    }

    if (!runtime.config.url) {
      throw new Error(`MCP server "${runtime.name}" URL is not configured`);
    }

    if (runtime.config.transport === 'sse') {
      return new McpSseClient({
        url: runtime.config.url,
        timeoutMs: runtime.config.timeoutMs,
        headers: runtime.config.headers,
      });
    }

    return new McpStreamableHttpClient({
      url: runtime.config.url,
      timeoutMs: runtime.config.timeoutMs,
      headers: runtime.config.headers,
    });
  }

  private rebuildDynamicTools(): void {
    const dynamicTools: DynamicToolRegistration[] = [];
    const routes = new Map<string, ToolRoute>();
    const aliasCounts = new Map<string, number>();

    for (const runtime of this.runtimes.values()) {
      if (!runtime.connected || !runtime.config.enabled) {
        continue;
      }

      for (const tool of runtime.tools) {
        const baseAlias = this.createToolAlias(runtime.name, tool.name);
        const aliasCount = aliasCounts.get(baseAlias) ?? 0;
        const alias = aliasCount === 0
          ? baseAlias
          : `${baseAlias.slice(0, 60)}_${aliasCount}`.slice(0, 64);
        aliasCounts.set(baseAlias, aliasCount + 1);

        const definition: ToolDefinition = {
          name: alias,
          description: `[MCP:${runtime.name}] ${tool.description || `Tool ${tool.name}`}`,
          input_schema: normalizeInputSchema(tool.inputSchema),
          permission: 'ask',
        };

        const execute = async (input: Record<string, unknown>): Promise<ToolResult> => {
          const activeRuntime = this.runtimes.get(runtime.name);
          if (!activeRuntime || !activeRuntime.config.enabled) {
            return {
              success: false,
              error: `MCP server "${runtime.name}" is not enabled`,
            };
          }

          if (activeRuntime.config.transport === 'stdio' && !activeRuntime.config.command) {
            return {
              success: false,
              error: `MCP server "${runtime.name}" command is not configured`,
            };
          }

          if (activeRuntime.config.transport !== 'stdio' && !activeRuntime.config.url) {
            return {
              success: false,
              error: `MCP server "${runtime.name}" URL is not configured`,
            };
          }

          try {
            const client = activeRuntime.client ?? this.createClient(activeRuntime);
            activeRuntime.client = client;
            await client.start();
            const callResult = await client.callTool(tool.name, input);
            activeRuntime.connected = true;
            activeRuntime.lastError = undefined;
            if (callResult.isError) {
              return {
                success: false,
                error: callResult.output,
              };
            }
            return {
              success: true,
              output: callResult.output,
            };
          } catch (error) {
            const message = toErrorMessage(error);
            activeRuntime.connected = false;
            activeRuntime.lastError = message;
            activeRuntime.client?.stop();
            activeRuntime.client = null;
            return {
              success: false,
              error: `MCP "${runtime.name}.${tool.name}" failed: ${message}`,
            };
          }
        };

        dynamicTools.push({ definition, execute });
        routes.set(alias, {
          serverName: runtime.name,
          serverToolName: tool.name,
        });
      }
    }

    this.dynamicTools = dynamicTools;
    this.toolRoutes.clear();
    for (const [alias, route] of routes.entries()) {
      this.toolRoutes.set(alias, route);
    }
  }

  private createToolAlias(serverName: string, toolName: string): string {
    const serverPart = sanitizeIdentifier(serverName, 16);
    const toolPart = sanitizeIdentifier(toolName, 24);
    const hash = shortHash(`${serverName}:${toolName}`).slice(0, 6);
    const alias = `mcp_${serverPart}_${toolPart}_${hash}`;
    return alias.slice(0, 64);
  }
}
