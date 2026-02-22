import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

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

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface McpStdIoClientConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs: number;
  workspaceRoot: string;
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

function ensureDirectory(baseDirectory: string, target?: string): string {
  if (!target) {
    return baseDirectory;
  }

  if (path.isAbsolute(target)) {
    return target;
  }

  return path.resolve(baseDirectory, target);
}

function parseJsonRpcError(error: JsonRpcErrorPayload | undefined): string {
  if (!error) {
    return 'Unknown MCP error';
  }

  const codeText = typeof error.code === 'number' ? ` (${error.code})` : '';
  const dataText = error.data === undefined ? '' : ` data=${JSON.stringify(error.data)}`;
  return `${error.message ?? 'Unknown MCP error'}${codeText}${dataText}`;
}

function contentLengthFromHeaders(rawHeaders: string): number | null {
  const lines = rawHeaders.split('\r\n');
  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;
    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    if (name !== 'content-length') continue;
    const value = line.slice(separatorIndex + 1).trim();
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
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

export class McpStdIoClient {
  private readonly config: McpStdIoClientConfig;
  private childProcess: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = Buffer.alloc(0);
  private nextRequestId = 1;
  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly stderrLines: string[] = [];
  private toolsCache: McpToolDescriptor[] = [];

  constructor(config: McpStdIoClientConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  getLastStderr(): string {
    return this.stderrLines.join('\n');
  }

  async start(): Promise<void> {
    if (this.childProcess) {
      return;
    }

    const cwd = ensureDirectory(this.config.workspaceRoot, this.config.cwd);
    const env = {
      ...process.env,
      ...this.config.env,
    };

    const child = spawn(this.config.command, this.config.args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    this.childProcess = child;
    this.stdoutBuffer = Buffer.alloc(0);
    this.toolsCache = [];
    this.stderrLines.length = 0;

    child.stdout.on('data', (chunk: Buffer) => {
      this.handleStdoutChunk(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      this.handleStderrChunk(chunk);
    });

    child.on('exit', (code, signal) => {
      const reason = `MCP server exited (code=${String(code)}, signal=${String(signal)})`;
      this.rejectAllPending(new Error(reason));
      this.childProcess = null;
    });

    child.on('error', (error) => {
      this.rejectAllPending(new Error(`MCP server process error: ${toErrorMessage(error)}`));
    });

    await this.awaitSpawn(child);

    try {
      await this.initialize();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.rejectAllPending(new Error('MCP server stopped'));

    if (this.childProcess && !this.childProcess.killed) {
      this.childProcess.kill();
    }

    this.childProcess = null;
    this.stdoutBuffer = Buffer.alloc(0);
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
      const params = cursor ? { cursor } : {};
      const result = await this.sendRequest('tools/list', params);
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

    const output = stringifyToolCallOutput(result);
    const isError = isToolCallError(result);
    return {
      isError,
      output: output || '(no output)',
    };
  }

  private async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ai-desktop-assistant',
        version: '1.2.0',
      },
    });

    // Most MCP servers expect this notification after initialize.
    this.sendNotification('notifications/initialized', {});
  }

  private awaitSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const onSpawn = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onError = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        child.removeListener('spawn', onSpawn);
        child.removeListener('error', onError);
      };

      child.once('spawn', onSpawn);
      child.once('error', onError);
    });
  }

  private handleStderrChunk(chunk: Buffer): void {
    const lines = chunk.toString('utf-8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      this.stderrLines.push(line);
    }
    if (this.stderrLines.length > 20) {
      this.stderrLines.splice(0, this.stderrLines.length - 20);
    }
  }

  private handleStdoutChunk(chunk: Buffer): void {
    this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);
    this.processStdoutBuffer();
  }

  private processStdoutBuffer(): void {
    while (this.stdoutBuffer.length > 0) {
      const headerEnd = this.stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        return;
      }

      const rawHeaders = this.stdoutBuffer.slice(0, headerEnd).toString('utf-8');
      const contentLength = contentLengthFromHeaders(rawHeaders);
      if (contentLength === null) {
        // Malformed frame; drop the current header block and continue.
        this.stdoutBuffer = this.stdoutBuffer.slice(headerEnd + 4);
        continue;
      }

      const totalLength = headerEnd + 4 + contentLength;
      if (this.stdoutBuffer.length < totalLength) {
        return;
      }

      const payloadBuffer = this.stdoutBuffer.slice(headerEnd + 4, totalLength);
      this.stdoutBuffer = this.stdoutBuffer.slice(totalLength);

      try {
        const parsed = JSON.parse(payloadBuffer.toString('utf-8')) as JsonRpcResponsePayload;
        this.handleMessage(parsed);
      } catch (error) {
        // Keep stream alive; malformed server message should not crash client.
        const message = toErrorMessage(error);
        this.stderrLines.push(`Malformed MCP payload: ${message}`);
      }
    }
  }

  private handleMessage(message: JsonRpcResponsePayload): void {
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

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    const payload: JsonRpcNotificationPayload = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.writePayload(payload);
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextRequestId++;
    const payload: JsonRpcRequestPayload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout (${method})`));
      }, this.config.timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      try {
        this.writePayload(payload);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private writePayload(payload: JsonRpcRequestPayload | JsonRpcNotificationPayload): void {
    if (!this.childProcess) {
      throw new Error('MCP server is not running');
    }

    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf-8');
    this.childProcess.stdin.write(Buffer.concat([header, body]));
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }
}
