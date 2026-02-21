import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ToolExecutor } from '../tool-executor';
import type { ChatMessage, ModelConfig, StreamChunk } from '../types';
import { StreamAbortedError } from '../utils/errors';
import {
  ANTHROPIC_FINE_GRAINED_TOOL_STREAMING_BETA,
  DEFAULT_ANTHROPIC_SYSTEM_PROMPT,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENAI_SYSTEM_PROMPT,
  MAX_TOOL_ITERATIONS,
  WAITING_FOR_AI_RESPONSE_MESSAGE,
  truncateToolResultContent,
} from './claude-service-constants';

interface AnthropicStreamOptions {
  client: Anthropic;
  config: ModelConfig;
  messageHistory: ChatMessage[];
  toolExecutor: ToolExecutor;
  toolsEnabled: boolean;
  abortSignal: AbortSignal | null;
  systemPrompt?: string;
  fineGrainedToolStreamingEnabled: boolean;
  disableFineGrainedToolStreaming: () => void;
}

interface OpenAIStreamOptions {
  client: OpenAI;
  config: ModelConfig;
  messageHistory: ChatMessage[];
  abortSignal: AbortSignal | null;
  systemPrompt?: string;
}

function throwIfAborted(signal: AbortSignal | null): void {
  if (signal?.aborted) {
    throw new StreamAbortedError();
  }
}

function shouldDisableFineGrainedToolStreaming(error: unknown): boolean {
  const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    errorMessage.includes('beta') ||
    errorMessage.includes('anthropic-beta') ||
    errorMessage.includes('unsupported')
  );
}

export async function* streamAnthropicWithTools(
  options: AnthropicStreamOptions,
): AsyncGenerator<StreamChunk, void, unknown> {
  const maxTokens = options.config.maxTokens ?? DEFAULT_MAX_TOKENS;

  const messages: Anthropic.MessageParam[] = options.messageHistory.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  const tools = options.toolsEnabled ? options.toolExecutor.getToolDefinitions() : undefined;

  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const requestPayload = {
      model: options.config.model,
      max_tokens: maxTokens,
      system: options.systemPrompt || DEFAULT_ANTHROPIC_SYSTEM_PROMPT,
      messages,
      tools: tools as Anthropic.Tool[],
      stream: true as const,
    };

    const baseRequestOptions: Anthropic.RequestOptions = {
      signal: options.abortSignal ?? undefined,
    };

    let stream: AsyncIterable<Anthropic.RawMessageStreamEvent>;
    if (options.fineGrainedToolStreamingEnabled) {
      try {
        stream = await options.client.messages.create(requestPayload, {
          ...baseRequestOptions,
          headers: {
            'anthropic-beta': ANTHROPIC_FINE_GRAINED_TOOL_STREAMING_BETA,
          },
        });
      } catch (error) {
        if (!shouldDisableFineGrainedToolStreaming(error)) {
          throw error;
        }

        console.warn(
          '[claude-service] Fine-grained tool streaming beta unsupported, fallback to default tool streaming:',
          error,
        );
        options.disableFineGrainedToolStreaming();
        stream = await options.client.messages.create(requestPayload, baseRequestOptions);
      }
    } else {
      stream = await options.client.messages.create(requestPayload, baseRequestOptions);
    }

    let textContent = '';
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let currentToolName = '';
    let currentToolId = '';
    let currentToolInput = '';

    for await (const event of stream) {
      throwIfAborted(options.abortSignal);

      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolName = event.content_block.name;
          currentToolId = event.content_block.id;
          currentToolInput = '';

          yield {
            type: 'tool_use',
            content: `Preparing tool: ${currentToolName}`,
            toolUse: { id: currentToolId, name: currentToolName, input: {} },
            toolUseComplete: false,
          };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          textContent += event.delta.text;
          yield { type: 'text', content: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json;

          if (currentToolId && currentToolName) {
            yield {
              type: 'tool_input_delta',
              content: event.delta.partial_json,
              toolInputDelta: {
                id: currentToolId,
                name: currentToolName,
                delta: event.delta.partial_json,
                accumulated: currentToolInput,
              },
            };
          }
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolName && currentToolId) {
          try {
            const input = currentToolInput ? JSON.parse(currentToolInput) : {};
            toolUses.push({ id: currentToolId, name: currentToolName, input });

            yield {
              type: 'tool_use',
              content: `Using tool: ${currentToolName}`,
              toolUse: { id: currentToolId, name: currentToolName, input },
              toolUseComplete: true,
            };
          } catch {
            // Invalid JSON from partial tool args; skip this tool event.
          }

          currentToolName = '';
          currentToolId = '';
          currentToolInput = '';
        }
      }
    }

    if (toolUses.length === 0) {
      break;
    }

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

    messages.push({ role: 'assistant', content: assistantContent });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      yield {
        type: 'tool_start',
        content: `Executing tool: ${toolUse.name}`,
        toolUse: { id: toolUse.id, name: toolUse.name, input: toolUse.input },
      };

      const result = await options.toolExecutor.executeTool(toolUse.name, toolUse.input);
      const rawToolResultContent = result.success
        ? (result.output || 'Success')
        : `Tool ${toolUse.name} failed: ${result.error}`;
      const toolResultContent = truncateToolResultContent(rawToolResultContent);

      yield {
        type: 'tool_result',
        content: toolResultContent,
        toolUse: { id: toolUse.id, name: toolUse.name, input: toolUse.input },
      };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: truncateToolResultContent(
          result.success ? (result.output || 'Success') : (result.error || 'Unknown error'),
        ),
        is_error: !result.success,
      });
    }

    yield { type: 'processing', content: WAITING_FOR_AI_RESPONSE_MESSAGE };
    messages.push({ role: 'user', content: toolResults });
  }
}

export async function* streamOpenAICompatible(
  options: OpenAIStreamOptions,
): AsyncGenerator<StreamChunk, void, unknown> {
  const maxTokens = options.config.maxTokens ?? DEFAULT_MAX_TOKENS;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: options.systemPrompt || DEFAULT_OPENAI_SYSTEM_PROMPT },
    ...options.messageHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  const stream = await options.client.chat.completions.create(
    {
      model: options.config.model,
      messages,
      stream: true,
      max_tokens: maxTokens,
    },
    {
      signal: options.abortSignal ?? undefined,
    },
  );

  for await (const chunk of stream) {
    throwIfAborted(options.abortSignal);

    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield { type: 'text', content };
    }
  }
}
