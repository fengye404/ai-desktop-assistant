interface JsonRpcErrorPayload {
  code?: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcResponsePayload {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: JsonRpcErrorPayload;
}

interface JsonRpcRequestPayload {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotificationPayload {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface McpHttpClientConfig {
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpToolCallResult {
  isError: boolean;
  output: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonRpcError(error: JsonRpcErrorPayload | undefined): string {
  if (!error) {
    return 'Unknown MCP error';
  }

  const codeText = typeof error.code === 'number' ? ` (${error.code})` : '';
  const dataText = error.data === undefined ? '' : ` data=${JSON.stringify(error.data)}`;
  return `${error.message ?? 'Unknown MCP error'}${codeText}${dataText}`;
}

function normalizeToolDescriptor(raw: unknown): McpToolDescriptor | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const name = source.name;
  if (typeof name !== 'string' || !name.trim()) {
    return null;
  }

  const description = typeof source.description === 'string'
    ? source.description
    : '';

  return {
    name: name.trim(),
    description,
    inputSchema: source.inputSchema ?? {},
  };
}

function stringifyToolCallOutput(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (!result || typeof result !== 'object') {
    return JSON.stringify(result);
  }

  const source = result as Record<string, unknown>;
  const textChunks: string[] = [];
  const content = Array.isArray(source.content) ? source.content : [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const payload = block as Record<string, unknown>;
    if (payload.type === 'text' && typeof payload.text === 'string') {
      textChunks.push(payload.text);
      continue;
    }
    textChunks.push(JSON.stringify(payload));
  }

  if (textChunks.length > 0) {
    return textChunks.join('\n');
  }

  if (source.structuredContent !== undefined) {
    return JSON.stringify(source.structuredContent, null, 2);
  }

  return JSON.stringify(source, null, 2);
}

function isToolCallError(result: unknown): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const source = result as Record<string, unknown>;
  return Boolean(source.isError === true);
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}

function parseSseJsonRpcResponse(bodyText: string, requestId: number): JsonRpcResponsePayload | null {
  const normalized = bodyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const parsed = parseSseBlock(block);
    if (!parsed) continue;
    if (!parsed.data.trim()) continue;

    try {
      const message = JSON.parse(parsed.data) as JsonRpcResponsePayload;
      if (message && typeof message.id === 'number' && message.id === requestId) {
        return message;
      }
    } catch {
      // Ignore non-JSON events.
    }
  }

  return null;
}

export class McpStreamableHttpClient {
  private readonly config: McpHttpClientConfig;
  private nextRequestId = 1;
  private initialized = false;
  private toolsCache: McpToolDescriptor[] = [];

  constructor(config: McpHttpClientConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ai-desktop-assistant',
        version: '1.2.0',
      },
    });

    await this.sendNotification('notifications/initialized', {});
    this.initialized = true;
  }

  stop(): void {
    this.initialized = false;
    this.toolsCache = [];
  }

  async listTools(forceRefresh = false): Promise<McpToolDescriptor[]> {
    await this.start();
    if (!forceRefresh && this.toolsCache.length > 0) {
      return this.toolsCache;
    }

    const tools: McpToolDescriptor[] = [];
    let cursor: string | undefined;
    let loopCount = 0;

    do {
      const result = await this.sendRequest('tools/list', cursor ? { cursor } : {});
      const payload = (result && typeof result === 'object')
        ? (result as Record<string, unknown>)
        : {};
      const batch = Array.isArray(payload.tools) ? payload.tools : [];
      for (const item of batch) {
        const descriptor = normalizeToolDescriptor(item);
        if (descriptor) {
          tools.push(descriptor);
        }
      }

      cursor = typeof payload.nextCursor === 'string'
        ? payload.nextCursor
        : undefined;

      loopCount += 1;
      if (loopCount >= 20) {
        break;
      }
    } while (cursor);

    this.toolsCache = tools;
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.start();
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    return {
      isError: isToolCallError(result),
      output: stringifyToolCallOutput(result) || '(no output)',
    };
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextRequestId++;
    const payload: JsonRpcRequestPayload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const responsePayload = await this.postJsonRpc(payload, true);
    if (!responsePayload) {
      throw new Error(`Empty MCP response: ${method}`);
    }

    if (responsePayload.error) {
      throw new Error(parseJsonRpcError(responsePayload.error));
    }

    return responsePayload.result;
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const payload: JsonRpcNotificationPayload = {
      jsonrpc: '2.0',
      method,
      params,
    };
    await this.postJsonRpc(payload, false);
  }

  private async postJsonRpc(
    payload: JsonRpcRequestPayload | JsonRpcNotificationPayload,
    expectResponse: boolean,
  ): Promise<JsonRpcResponsePayload | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${bodyText ? ` | ${bodyText}` : ''}`);
      }

      if (!expectResponse) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const bodyText = await response.text();
      if (!bodyText.trim()) {
        return null;
      }

      if (contentType.includes('application/json')) {
        return JSON.parse(bodyText) as JsonRpcResponsePayload;
      }

      if (contentType.includes('text/event-stream') && 'id' in payload) {
        const fromSse = parseSseJsonRpcResponse(bodyText, payload.id);
        if (fromSse) {
          return fromSse;
        }
        throw new Error('No matching JSON-RPC response found in streamable HTTP SSE payload');
      }

      throw new Error(`Unsupported streamable HTTP response content-type: ${contentType || '(empty)'}`);
    } catch (error) {
      const message = toErrorMessage(error);
      if (message.toLowerCase().includes('abort')) {
        throw new Error(`MCP HTTP request timeout (${this.config.timeoutMs}ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
