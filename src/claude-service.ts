import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SessionStorage } from './session-storage';
import { ToolExecutor } from './tool-executor';
import type { ChatMessage, MessageItem, ModelConfig, Provider, StreamChunk, ToolCallRecord } from './types';
import { APIKeyError, StreamAbortedError } from './utils/errors';
import { DEFAULT_MAX_TOKENS, MAX_HISTORY_LENGTH } from './ai/claude-service-constants';
import { createProviderAdapterRegistry } from './ai/providers/provider-adapter-registry';
import type { ProviderStreamAdapter } from './ai/providers/provider-stream-adapter';

function isFailedToolResult(content: string): boolean {
  return content.includes('failed');
}

function updateToolRecordResult(record: ToolCallRecord, content: string): void {
  const failed = isFailedToolResult(content);
  record.status = failed ? 'error' : 'success';
  record.inputStreaming = false;
  record.inputText = undefined;
  if (failed) {
    record.error = content;
    record.output = undefined;
  } else {
    record.output = content;
    record.error = undefined;
  }
}

function findLatestActiveToolItem(items: MessageItem[]): { type: 'tool'; toolCall: ToolCallRecord } | undefined {
  return [...items].reverse().find(
    (item): item is { type: 'tool'; toolCall: ToolCallRecord } =>
      item.type === 'tool' &&
      (item.toolCall.status === 'running' || item.toolCall.status === 'queued'),
  );
}

export class ClaudeService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private config: ModelConfig;
  private abortController: AbortController | null = null;
  private readonly sessionStorage: SessionStorage;
  private readonly toolExecutor: ToolExecutor;
  private readonly providerAdapters: Map<Provider, ProviderStreamAdapter>;
  private toolsEnabled = true;
  private anthropicFineGrainedToolStreamingEnabled = true;

  constructor(sessionStorage: SessionStorage) {
    this.sessionStorage = sessionStorage;
    this.toolExecutor = new ToolExecutor();
    this.config = {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-opus-4-6',
      maxTokens: DEFAULT_MAX_TOKENS,
    };

    this.providerAdapters = createProviderAdapterRegistry({
      getAnthropicClient: () => this.getAnthropicClient(),
      getOpenAIClient: () => this.getOpenAIClient(),
      isFineGrainedToolStreamingEnabled: () => this.anthropicFineGrainedToolStreamingEnabled,
      disableFineGrainedToolStreaming: () => {
        this.anthropicFineGrainedToolStreamingEnabled = false;
      },
    });
  }

  setToolsEnabled(enabled: boolean): void {
    this.toolsEnabled = enabled;
  }

  setToolPermissionCallback(callback: (tool: string, input: Record<string, unknown>) => Promise<boolean>): void {
    this.toolExecutor.setPermissionCallback(callback);
  }

  setWorkingDirectory(dir: string): void {
    this.toolExecutor.setWorkingDirectory(dir);
  }

  private get messageHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  getHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  clearHistory(): void {
    this.sessionStorage.clearMessages();
  }

  private addToHistory(role: 'user' | 'assistant', content: string, items?: MessageItem[]): void {
    const messages = this.sessionStorage.getMessages();
    messages.push({
      role,
      content,
      items,
      timestamp: Date.now(),
    });

    const trimmedMessages = messages.length > MAX_HISTORY_LENGTH ? messages.slice(-MAX_HISTORY_LENGTH) : messages;
    this.sessionStorage.updateMessages(trimmedMessages);
  }

  private removeLastMessageFromHistory(): void {
    const messages = this.sessionStorage.getMessages();
    messages.pop();
    this.sessionStorage.updateMessages(messages);
  }

  setConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
    this.anthropicClient = null;
    this.openaiClient = null;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private getAnthropicClient(): Anthropic {
    if (!this.config.apiKey) {
      throw new APIKeyError('API key is required for Anthropic provider');
    }

    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });
    }

    return this.anthropicClient;
  }

  private getOpenAIClient(): OpenAI {
    if (!this.config.apiKey) {
      throw new APIKeyError('API key is required for OpenAI-compatible provider');
    }

    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });
    }

    return this.openaiClient;
  }

  private streamProviderResponse(
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const adapter = this.providerAdapters.get(this.config.provider);
    if (!adapter) {
      throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    return adapter.createStream({
      config: this.config,
      messageHistory: this.messageHistory,
      abortSignal: this.abortController?.signal ?? null,
      systemPrompt,
      toolsEnabled: this.toolsEnabled,
      toolExecutor: this.toolExecutor,
    });
  }

  async *sendMessageStream(
    message: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.abortController = new AbortController();
    this.addToHistory('user', message);

    let assistantResponse = '';
    const items: MessageItem[] = [];
    let currentTextContent = '';
    const toolCallsMap = new Map<string, ToolCallRecord>();

    try {
      for await (const chunk of this.streamProviderResponse(systemPrompt)) {
        if (chunk.type === 'text') {
          assistantResponse += chunk.content;
          currentTextContent += chunk.content;
        } else if (chunk.type === 'tool_input_delta' && chunk.toolInputDelta) {
          const toolRecord = toolCallsMap.get(chunk.toolInputDelta.id);
          if (toolRecord) {
            toolRecord.inputText = chunk.toolInputDelta.accumulated;
            toolRecord.inputStreaming = true;
          }
        } else if (chunk.type === 'tool_use' && chunk.toolUse) {
          const existingToolRecord = toolCallsMap.get(chunk.toolUse.id);

          if (existingToolRecord) {
            existingToolRecord.name = chunk.toolUse.name;
            existingToolRecord.input = chunk.toolUse.input;
            existingToolRecord.inputStreaming = chunk.toolUseComplete === false;
            existingToolRecord.inputText = chunk.toolUseComplete === false ? '' : undefined;
            if (existingToolRecord.status !== 'pending') {
              existingToolRecord.status = 'queued';
            }
          } else {
            if (currentTextContent) {
              items.push({ type: 'text', content: currentTextContent });
              currentTextContent = '';
            }

            const toolRecord: ToolCallRecord = {
              id: chunk.toolUse.id,
              name: chunk.toolUse.name,
              input: chunk.toolUse.input,
              status: 'queued',
              inputStreaming: chunk.toolUseComplete === false,
              inputText: chunk.toolUseComplete === false ? '' : undefined,
            };
            toolCallsMap.set(chunk.toolUse.id, toolRecord);
            items.push({ type: 'tool', toolCall: toolRecord });
          }
        } else if (chunk.type === 'tool_start' && chunk.toolUse) {
          const toolRecord = toolCallsMap.get(chunk.toolUse.id);
          if (toolRecord && toolRecord.status !== 'pending') {
            toolRecord.status = 'running';
          }
        } else if (chunk.type === 'tool_result') {
          const targetToolId = chunk.toolUse?.id;
          const targetToolRecord = targetToolId ? toolCallsMap.get(targetToolId) : undefined;

          if (targetToolRecord) {
            updateToolRecordResult(targetToolRecord, chunk.content);
          } else {
            const fallbackToolItem = findLatestActiveToolItem(items);
            if (!fallbackToolItem) {
              yield chunk;
              continue;
            }
            updateToolRecordResult(fallbackToolItem.toolCall, chunk.content);
          }
        }

        yield chunk;
      }

      if (currentTextContent) {
        items.push({ type: 'text', content: currentTextContent });
      }

      if (assistantResponse || items.length > 0) {
        this.addToHistory('assistant', assistantResponse, items.length > 0 ? items : undefined);
      }
    } catch (error) {
      if (error instanceof StreamAbortedError) {
        this.removeLastMessageFromHistory();
        throw error;
      }

      console.error('[claude-service] Stream error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: `Error: ${errorMessage}` };
    } finally {
      this.abortController = null;
    }
  }

  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.sendMessageStream(message, systemPrompt)) {
      if (chunk.type === 'error') {
        throw new Error(chunk.content);
      }
      if (chunk.type === 'text') {
        chunks.push(chunk.content);
      }
    }
    return chunks.join('');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const timeout = 15000;

    try {
      await Promise.race([
        this.sendMessage('Hi'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('连接超时，请检查网络或 API 地址')), timeout),
        ),
      ]);
      return { success: true, message: '连接成功！' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `连接失败: ${errorMessage}` };
    }
  }

  cleanup(): void {
    this.abort();
    this.anthropicClient = null;
    this.openaiClient = null;
  }
}
