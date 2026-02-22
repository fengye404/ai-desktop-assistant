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

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface McpSseClientConfig {
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

function normalizeSseEndpoint(baseUrl: string, endpointData: string): string | null {
  const raw = endpointData.trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

export class McpSseClient {
  private readonly config: McpSseClientConfig;
  private sseController: AbortController | null = null;
  private startPromise: Promise<void> | null = null;
  private initialized = false;
  private connected = false;
  private nextRequestId = 1;
  private sseBuffer = '';
  private postUrl: string;
  private toolsCache: McpToolDescriptor[] = [];
  private endpointWaiters: Array<(url: string) => void> = [];
  private readonly pendingRequests = new Map<number, PendingRequest>();

  constructor(config: McpSseClientConfig) {
    this.config = config;
    this.postUrl = config.url;
  }

  async start(): Promise<void> {
    if (this.initialized && this.connected) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  stop(): void {
    this.initialized = false;
    this.connected = false;
    this.toolsCache = [];
    this.postUrl = this.config.url;
    this.sseBuffer = '';
    this.endpointWaiters = [];

    this.rejectAllPending(new Error('MCP SSE transport stopped'));

    if (this.sseController) {
      this.sseController.abort();
      this.sseController = null;
    }

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

  private async startInternal(): Promise<void> {
    await this.openSseConnection();
    await this.waitForEndpointOrFallback(1500);

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

  private async openSseConnection(): Promise<void> {
    this.sseController = new AbortController();
    const response = await fetch(this.config.url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...this.config.headers,
      },
      signal: this.sseController.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`SSE connect failed: HTTP ${response.status} ${response.statusText}${bodyText ? ` | ${bodyText}` : ''}`);
    }

    if (!response.body) {
      throw new Error('SSE connect failed: empty response body');
    }

    this.connected = true;
    void this.readSseLoop(response.body).catch((error) => {
      this.connected = false;
      const message = toErrorMessage(error);
      this.rejectAllPending(new Error(`SSE read loop failed: ${message}`));
    });
  }

  private async readSseLoop(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');

    try {
      let shouldContinue = true;
      while (shouldContinue) {
        const { done, value } = await reader.read();
        if (done) {
          shouldContinue = false;
          continue;
        }

        const chunk = decoder.decode(value, { stream: true })
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
        this.sseBuffer += chunk;
        this.processSseBuffer();
      }
    } finally {
      reader.releaseLock();
    }
  }

  private processSseBuffer(): void {
    while (this.sseBuffer.length > 0) {
      const separatorIndex = this.sseBuffer.indexOf('\n\n');
      if (separatorIndex < 0) {
        return;
      }

      const rawBlock = this.sseBuffer.slice(0, separatorIndex);
      this.sseBuffer = this.sseBuffer.slice(separatorIndex + 2);

      const parsed = parseSseBlock(rawBlock);
      if (!parsed) {
        continue;
      }

      if (parsed.event === 'endpoint') {
        const endpoint = normalizeSseEndpoint(this.config.url, parsed.data);
        if (endpoint) {
          this.postUrl = endpoint;
          const waiters = [...this.endpointWaiters];
          this.endpointWaiters = [];
          for (const waiter of waiters) {
            waiter(endpoint);
          }
        }
        continue;
      }

      try {
        const message = JSON.parse(parsed.data) as JsonRpcResponsePayload;
        this.resolvePendingMessage(message);
      } catch {
        // Ignore non-JSON SSE messages.
      }
    }
  }

  private resolvePendingMessage(message: JsonRpcResponsePayload): void {
    if (typeof message.id !== 'number') {
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(new Error(parseJsonRpcError(message.error)));
      return;
    }

    pending.resolve(message.result);
  }

  private waitForEndpointOrFallback(waitMs: number): Promise<void> {
    if (this.postUrl !== this.config.url) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, waitMs);

      this.endpointWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('MCP SSE transport is not connected');
    }

    const id = this.nextRequestId++;
    const payload: JsonRpcRequestPayload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const pendingPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP SSE request timeout (${method})`));
      }, this.config.timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
    });

    try {
      const response = await fetch(this.postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`SSE POST failed: HTTP ${response.status} ${response.statusText}${bodyText ? ` | ${bodyText}` : ''}`);
      }

      const responseText = await response.text().catch(() => '');
      if (responseText.trim()) {
        try {
          const message = JSON.parse(responseText) as JsonRpcResponsePayload;
          if (typeof message.id === 'number' && message.id === id) {
            this.resolvePendingMessage(message);
          }
        } catch {
          // Ignore non-JSON response payload.
        }
      }

      return await pendingPromise;
    } catch (error) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);
      }
      throw error;
    }
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.connected) {
      throw new Error('MCP SSE transport is not connected');
    }

    const payload: JsonRpcNotificationPayload = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const response = await fetch(this.postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`SSE notification failed: HTTP ${response.status} ${response.statusText}${bodyText ? ` | ${bodyText}` : ''}`);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }
}
