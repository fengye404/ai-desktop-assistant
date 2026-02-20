import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ModelConfig, StreamChunk, ChatMessage } from './types';
import { StreamAbortedError, APIKeyError } from './utils/errors';
import { SessionStorage } from './session-storage';
import { ToolExecutor } from './tool-executor';

// Default max tokens for responses
const DEFAULT_MAX_TOKENS = 4096;

// Maximum number of messages to keep in history
const MAX_HISTORY_LENGTH = 50;

// Maximum tool use iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 10;

export class ClaudeService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private config: ModelConfig;
  private abortController: AbortController | null = null;
  private sessionStorage: SessionStorage;
  private toolExecutor: ToolExecutor;
  private toolsEnabled: boolean = true;

  constructor(sessionStorage: SessionStorage) {
    this.sessionStorage = sessionStorage;
    this.toolExecutor = new ToolExecutor();
    this.config = {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-opus-4-6',
      maxTokens: DEFAULT_MAX_TOKENS,
    };
  }

  /**
   * Enable or disable tool usage
   */
  setToolsEnabled(enabled: boolean): void {
    this.toolsEnabled = enabled;
  }

  /**
   * Set permission callback for tool execution
   */
  setToolPermissionCallback(callback: (tool: string, input: Record<string, unknown>) => Promise<boolean>): void {
    this.toolExecutor.setPermissionCallback(callback);
  }

  /**
   * Set working directory for tool execution
   */
  setWorkingDirectory(dir: string): void {
    this.toolExecutor.setWorkingDirectory(dir);
  }

  /**
   * Get message history from current session
   */
  private get messageHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  /**
   * Get the current message history
   */
  getHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  /**
   * Clear the message history
   */
  clearHistory(): void {
    this.sessionStorage.clearMessages();
  }

  /**
   * Add a message to history
   */
  private addToHistory(role: 'user' | 'assistant', content: string): void {
    const messages = this.sessionStorage.getMessages();
    messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Trim history if it exceeds max length
    const trimmedMessages =
      messages.length > MAX_HISTORY_LENGTH ? messages.slice(-MAX_HISTORY_LENGTH) : messages;

    this.sessionStorage.updateMessages(trimmedMessages);
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
        const messages = this.sessionStorage.getMessages();
        messages.pop();
        this.sessionStorage.updateMessages(messages);
        throw error;
      }
      console.error('[claude-service] Stream error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: `Error: ${errorMessage}` };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Stream using Anthropic API with tool support
   */
  private async *streamAnthropic(
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const client = this.getAnthropicClient();
    const maxTokens = this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

    // Convert message history to Anthropic format
    const messages: Anthropic.MessageParam[] = this.messageHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Get tool definitions if enabled
    const tools = this.toolsEnabled ? this.toolExecutor.getToolDefinitions() : undefined;

    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const stream = client.messages.stream(
        {
          model: this.config.model,
          max_tokens: maxTokens,
          system: systemPrompt || 'You are a helpful AI assistant. You have access to tools to help complete tasks.',
          messages,
          tools: tools as Anthropic.Tool[],
        },
        {
          signal: this.abortController?.signal,
        },
      );

      let textContent = '';
      const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      let currentToolName = '';
      let currentToolId = '';
      let currentToolInput = '';

      for await (const event of stream) {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          throw new StreamAbortedError();
        }

        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolName = event.content_block.name;
            currentToolId = event.content_block.id;
            currentToolInput = '';
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            textContent += event.delta.text;
            yield { type: 'text', content: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            currentToolInput += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolName && currentToolId) {
            try {
              const input = currentToolInput ? JSON.parse(currentToolInput) : {};
              toolUses.push({ id: currentToolId, name: currentToolName, input });

              // Notify UI about tool use
              yield {
                type: 'tool_use',
                content: `Using tool: ${currentToolName}`,
                toolUse: { id: currentToolId, name: currentToolName, input },
              };
            } catch {
              // Invalid JSON, skip this tool use
            }
            currentToolName = '';
            currentToolId = '';
            currentToolInput = '';
          }
        }
      }

      // If no tool uses, we're done
      if (toolUses.length === 0) {
        break;
      }

      // Build assistant message with tool uses
      const assistantContent: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      > = [];
      if (textContent) {
        assistantContent.push({ type: 'text', text: textContent });
      }
      for (const toolUse of toolUses) {
        assistantContent.push({
          type: 'tool_use',
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
        });
      }

      // Add assistant message to conversation
      messages.push({ role: 'assistant', content: assistantContent });

      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result = await this.toolExecutor.executeTool(toolUse.name, toolUse.input);

        yield {
          type: 'tool_result',
          content: result.success
            ? `Tool ${toolUse.name} completed`
            : `Tool ${toolUse.name} failed: ${result.error}`,
        };

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.success ? (result.output || 'Success') : (result.error || 'Unknown error'),
          is_error: !result.success,
        });
      }

      // Add tool results to conversation
      messages.push({ role: 'user', content: toolResults });
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
