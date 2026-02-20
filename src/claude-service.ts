import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ModelConfig, StreamChunk, ChatMessage } from './types';
import { StreamAbortedError, APIKeyError } from './utils/errors';

// Default max tokens for responses
const DEFAULT_MAX_TOKENS = 4096;

// Maximum number of messages to keep in history
const MAX_HISTORY_LENGTH = 50;

export class ClaudeService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private config: ModelConfig;
  private abortController: AbortController | null = null;
  private messageHistory: ChatMessage[] = [];

  constructor() {
    this.config = {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-opus-4-6',
      maxTokens: DEFAULT_MAX_TOKENS,
    };
  }

  /**
   * Get the current message history
   */
  getHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Clear the message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Add a message to history
   */
  private addToHistory(role: 'user' | 'assistant', content: string): void {
    this.messageHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Trim history if it exceeds max length
    if (this.messageHistory.length > MAX_HISTORY_LENGTH) {
      this.messageHistory = this.messageHistory.slice(-MAX_HISTORY_LENGTH);
    }
  }

  setConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset clients when config changes
    this.anthropicClient = null;
    this.openaiClient = null;
  }

  /**
   * Abort the current streaming operation
   */
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

  /**
   * Send a message with streaming
   */
  async *sendMessageStream(
    message: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Create new abort controller for this stream
    this.abortController = new AbortController();

    // Add user message to history
    this.addToHistory('user', message);

    // Collect assistant response
    let assistantResponse = '';

    try {
      if (this.config.provider === 'anthropic') {
        for await (const chunk of this.streamAnthropic(systemPrompt)) {
          if (chunk.type === 'text') {
            assistantResponse += chunk.content;
          }
          yield chunk;
        }
      } else {
        for await (const chunk of this.streamOpenAI(systemPrompt)) {
          if (chunk.type === 'text') {
            assistantResponse += chunk.content;
          }
          yield chunk;
        }
      }

      // Add assistant response to history
      if (assistantResponse) {
        this.addToHistory('assistant', assistantResponse);
      }
    } catch (error) {
      // Remove the user message if there was an error
      if (error instanceof StreamAbortedError) {
        this.messageHistory.pop();
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: `Error: ${errorMessage}` };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Stream using Anthropic API
   */
  private async *streamAnthropic(
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getAnthropicClient();
    const maxTokens = this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

    // Convert message history to Anthropic format
    const messages = this.messageHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const stream = client.messages.stream(
      {
        model: this.config.model,
        max_tokens: maxTokens,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages,
      },
      {
        signal: this.abortController?.signal,
      },
    );

    for await (const event of stream) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new StreamAbortedError();
      }

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', content: event.delta.text };
      }
    }
  }

  /**
   * Stream using OpenAI-compatible API
   */
  private async *streamOpenAI(
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getOpenAIClient();
    const maxTokens = this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

    // Convert message history to OpenAI format
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
      ...this.messageHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    const stream = await client.chat.completions.create(
      {
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: maxTokens,
      },
      {
        signal: this.abortController?.signal,
      },
    );

    for await (const chunk of stream) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new StreamAbortedError();
      }

      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: 'text', content };
      }
    }
  }

  /**
   * Send a message and get the complete response
   */
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

  /**
   * Test API connection with timeout
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const timeout = 15000; // 15 seconds timeout

    try {
      await Promise.race([
        this.sendMessage('Hi'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('连接超时，请检查网络或 API 地址')), timeout)
        ),
      ]);
      return { success: true, message: '连接成功！' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `连接失败: ${errorMessage}` };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.abort();
    this.anthropicClient = null;
    this.openaiClient = null;
  }
}
