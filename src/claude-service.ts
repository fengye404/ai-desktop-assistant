import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SessionStorage } from './session-storage';
import { ToolExecutor, type DynamicToolRegistration } from './tool-executor';
import type {
  ChatMessage,
  ChatImageAttachment,
  CompactHistoryResult,
  MessageItem,
  ModelConfig,
  Provider,
  RewindHistoryResult,
  StreamChunk,
  ToolCallRecord,
} from './types';
import { APIKeyError, StreamAbortedError } from './utils/errors';
import {
  AUTO_COMPACTION_TRIGGER_ESTIMATED_TOKENS,
  DEFAULT_MAX_TOKENS,
  KEEP_RECENT_MESSAGES_AFTER_COMPACTION,
  MAX_COMPACTION_SUMMARY_CHARS,
  MAX_COMPACTION_SUMMARY_LINES,
  MAX_HISTORY_LENGTH,
  MIN_MESSAGES_FOR_COMPACTION,
} from './ai/claude-service-constants';
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

interface SendMessageOptions {
  messageForModel?: string;
  attachments?: ChatImageAttachment[];
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateTokensFromHistory(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + estimateTokensFromText(message.content), 0);
}

function compactTextSnippet(content: string, maxLength = 180): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '(空)';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function summarizeToolItems(items?: MessageItem[]): string[] {
  if (!items || items.length === 0) {
    return [];
  }

  const toolItems = items
    .filter((item): item is { type: 'tool'; toolCall: ToolCallRecord } => item.type === 'tool')
    .slice(0, 3);

  return toolItems.map((item) => {
    const outputSnippet = item.toolCall.output ? ` | 输出: ${compactTextSnippet(item.toolCall.output, 80)}` : '';
    const errorSnippet = item.toolCall.error ? ` | 错误: ${compactTextSnippet(item.toolCall.error, 80)}` : '';
    return `工具 ${item.toolCall.name}(${item.toolCall.status})${outputSnippet}${errorSnippet}`;
  });
}

function summarizeAttachments(attachments?: ChatImageAttachment[]): string[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments
    .slice(0, 3)
    .map((attachment) => (
      `图片 ${attachment.name || '未命名'} (${attachment.mimeType}, ${Math.max(1, Math.round(attachment.sizeBytes / 1024))}KB)`
    ));
}

function buildCompactionSummary(messages: ChatMessage[]): string {
  const lines: string[] = [
    '[上下文压缩摘要]',
    '以下是较早对话的关键记录，请作为后续交流的上下文基础。',
  ];

  for (const message of messages) {
    const roleLabel = message.role === 'user' ? '用户' : '助手';
    lines.push(`${roleLabel}: ${compactTextSnippet(message.content)}`);

    const attachmentSummaries = summarizeAttachments(message.attachments);
    for (const attachmentSummary of attachmentSummaries) {
      lines.push(`附件记录: ${attachmentSummary}`);
    }

    const toolSummaries = summarizeToolItems(message.items);
    for (const toolSummary of toolSummaries) {
      lines.push(`工具记录: ${toolSummary}`);
    }

    if (lines.length >= MAX_COMPACTION_SUMMARY_LINES) {
      lines.push(`(摘要已截断，最多保留 ${MAX_COMPACTION_SUMMARY_LINES} 行)`);
      break;
    }
  }

  const summary = lines.join('\n');
  if (summary.length <= MAX_COMPACTION_SUMMARY_CHARS) {
    return summary;
  }

  return `${summary.slice(0, MAX_COMPACTION_SUMMARY_CHARS)}\n(摘要内容过长，已截断)`;
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

  setDynamicTools(tools: DynamicToolRegistration[]): void {
    this.toolExecutor.setDynamicTools(tools);
  }

  setWorkingDirectory(dir: string): void {
    this.toolExecutor.setWorkingDirectory(dir);
  }

  getHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  clearHistory(): void {
    this.sessionStorage.clearMessages();
  }

  compactHistory(): CompactHistoryResult {
    const messages = this.sessionStorage.getMessages();
    const beforeMessageCount = messages.length;
    const beforeEstimatedTokens = estimateTokensFromHistory(messages);

    if (beforeMessageCount < MIN_MESSAGES_FOR_COMPACTION) {
      return {
        success: true,
        skipped: true,
        reason: `消息数量少于 ${MIN_MESSAGES_FOR_COMPACTION}，无需压缩`,
        beforeMessageCount,
        afterMessageCount: beforeMessageCount,
        removedMessageCount: 0,
        beforeEstimatedTokens,
        afterEstimatedTokens: beforeEstimatedTokens,
      };
    }

    const keepRecentCount = Math.min(
      KEEP_RECENT_MESSAGES_AFTER_COMPACTION,
      Math.max(2, Math.floor(beforeMessageCount / 2)),
    );
    const splitIndex = Math.max(1, beforeMessageCount - keepRecentCount);
    const toSummarize = messages.slice(0, splitIndex);
    const recentMessages = messages.slice(splitIndex);

    if (toSummarize.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: '没有可压缩的历史消息',
        beforeMessageCount,
        afterMessageCount: beforeMessageCount,
        removedMessageCount: 0,
        beforeEstimatedTokens,
        afterEstimatedTokens: beforeEstimatedTokens,
      };
    }

    const summaryMessage: ChatMessage = {
      role: 'user',
      content: buildCompactionSummary(toSummarize),
      timestamp: toSummarize[0].timestamp ?? Date.now(),
    };

    const compactedMessages = [summaryMessage, ...recentMessages];
    this.sessionStorage.updateMessages(compactedMessages);

    const afterMessageCount = compactedMessages.length;
    const afterEstimatedTokens = estimateTokensFromHistory(compactedMessages);

    return {
      success: true,
      skipped: false,
      beforeMessageCount,
      afterMessageCount,
      removedMessageCount: beforeMessageCount - afterMessageCount,
      beforeEstimatedTokens,
      afterEstimatedTokens,
    };
  }

  rewindLastTurn(): RewindHistoryResult {
    const messages = this.sessionStorage.getMessages();
    if (messages.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: '当前会话暂无可回退内容',
        removedMessageCount: 0,
        remainingMessageCount: 0,
      };
    }

    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') {
        lastUserIndex = index;
        break;
      }
    }

    const rewindFromIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length - 1;
    const removedMessageCount = messages.length - rewindFromIndex;

    if (removedMessageCount <= 0) {
      return {
        success: true,
        skipped: true,
        reason: '未找到可回退的最近轮次',
        removedMessageCount: 0,
        remainingMessageCount: messages.length,
      };
    }

    messages.splice(rewindFromIndex);
    this.sessionStorage.updateMessages(messages);

    return {
      success: true,
      skipped: false,
      removedMessageCount,
      remainingMessageCount: messages.length,
    };
  }

  private maybeAutoCompactHistory(): void {
    const messages = this.sessionStorage.getMessages();
    if (messages.length < MIN_MESSAGES_FOR_COMPACTION) {
      return;
    }

    const estimatedTokens = estimateTokensFromHistory(messages);
    if (estimatedTokens < AUTO_COMPACTION_TRIGGER_ESTIMATED_TOKENS) {
      return;
    }

    const result = this.compactHistory();
    if (!result.skipped) {
      console.info(
        `[claude-service] Auto compact history: ${result.beforeEstimatedTokens} -> ${result.afterEstimatedTokens} tokens`,
      );
    }
  }

  private addToHistory(
    role: 'user' | 'assistant',
    content: string,
    items?: MessageItem[],
    attachments?: ChatImageAttachment[],
  ): void {
    const messages = this.sessionStorage.getMessages();
    messages.push({
      role,
      content,
      attachments,
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
    messageHistory: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const adapter = this.providerAdapters.get(this.config.provider);
    if (!adapter) {
      throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    return adapter.createStream({
      config: this.config,
      messageHistory,
      abortSignal: this.abortController?.signal ?? null,
      systemPrompt,
      toolsEnabled: this.toolsEnabled,
      toolExecutor: this.toolExecutor,
    });
  }

  async *sendMessageStream(
    message: string,
    systemPrompt?: string,
    options?: SendMessageOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.maybeAutoCompactHistory();

    this.abortController = new AbortController();
    this.addToHistory('user', message, undefined, options?.attachments);
    const historyForModel = this.sessionStorage.getMessages();
    const modelMessage = options?.messageForModel?.trim();
    if (modelMessage && historyForModel.length > 0) {
      const lastIndex = historyForModel.length - 1;
      historyForModel[lastIndex] = {
        ...historyForModel[lastIndex],
        content: modelMessage,
      };
    }

    let assistantResponse = '';
    const items: MessageItem[] = [];
    let currentTextContent = '';
    const toolCallsMap = new Map<string, ToolCallRecord>();

    try {
      for await (const chunk of this.streamProviderResponse(historyForModel, systemPrompt)) {
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

  async sendMessage(message: string, systemPrompt?: string, options?: SendMessageOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.sendMessageStream(message, systemPrompt, options)) {
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
