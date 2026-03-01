/**
 * Bidirectional message format transformer: Anthropic Messages API ↔ OpenAI Chat Completions API.
 *
 * Handles system prompts, user/assistant messages, image attachments,
 * tool-use blocks, tool-result blocks, and thinking blocks.
 */

import type {
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicRequest,
  OpenAIContentPart,
  OpenAIMessage,
  OpenAIRequest,
  OpenAIToolCallWire,
} from '../types';

// ---------------------------------------------------------------------------
// Anthropic → OpenAI
// ---------------------------------------------------------------------------

export function anthropicRequestToOpenAI(req: AnthropicRequest): OpenAIRequest {
  const openAIMessages: OpenAIMessage[] = [];

  if (req.system) {
    const systemText =
      typeof req.system === 'string'
        ? req.system
        : req.system
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
    if (systemText) {
      openAIMessages.push({ role: 'system', content: systemText });
    }
  }

  for (const msg of req.messages) {
    openAIMessages.push(...convertAnthropicMessage(msg));
  }

  const result: OpenAIRequest = {
    model: req.model,
    messages: openAIMessages,
    stream: req.stream ?? false,
  };

  // Request usage metrics in streaming mode so token stats are available.
  if (result.stream) {
    result.stream_options = { include_usage: true };
  }

  if (req.max_tokens != null) result.max_tokens = req.max_tokens;
  if (req.temperature != null) result.temperature = req.temperature;
  if (req.top_p != null) result.top_p = req.top_p;
  if (req.stop_sequences?.length) result.stop = req.stop_sequences;
  if (req.metadata?.user_id) result.user = req.metadata.user_id;

  if (req.tools?.length) {
    result.tools = req.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  return result;
}

function convertAnthropicMessage(msg: AnthropicMessage): OpenAIMessage[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }];
  }

  const blocks = msg.content as AnthropicContentBlock[];

  if (msg.role === 'user') {
    return convertUserBlocks(blocks);
  }

  return [convertAssistantBlocks(blocks)];
}

function convertUserBlocks(blocks: AnthropicContentBlock[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];
  const contentParts: OpenAIContentPart[] = [];
  const toolResults: OpenAIMessage[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        contentParts.push({ type: 'text', text: block.text });
        break;
      case 'image':
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        });
        break;
      case 'tool_result': {
        const content =
          typeof block.content === 'string'
            ? block.content
            : (block.content as AnthropicContentBlock[])
                .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                .map((b) => b.text)
                .join('\n');
        toolResults.push({
          role: 'tool',
          content: block.is_error ? `[ERROR] ${content}` : content,
          tool_call_id: block.tool_use_id,
        });
        break;
      }
      default:
        break;
    }
  }

  if (toolResults.length > 0) {
    result.push(...toolResults);
  }

  if (contentParts.length > 0) {
    const canSimplify =
      contentParts.length === 1 && contentParts[0].type === 'text';
    result.push({
      role: 'user',
      content: canSimplify
        ? (contentParts[0] as { type: 'text'; text: string }).text
        : contentParts,
    });
  }

  if (result.length === 0) {
    result.push({ role: 'user', content: '' });
  }

  return result;
}

function convertAssistantBlocks(blocks: AnthropicContentBlock[]): OpenAIMessage {
  let textContent = '';
  const toolCalls: OpenAIToolCallWire[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        textContent += block.text;
        break;
      case 'tool_use':
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
        break;
      case 'thinking':
        // Thinking blocks are Anthropic-specific; omit for OpenAI
        break;
      default:
        break;
    }
  }

  const msg: OpenAIMessage = {
    role: 'assistant',
    content: textContent || null,
  };

  if (toolCalls.length > 0) {
    msg.tool_calls = toolCalls;
  }

  return msg;
}

// ---------------------------------------------------------------------------
// OpenAI → Anthropic
// ---------------------------------------------------------------------------

export function openAIRequestToAnthropic(req: OpenAIRequest): AnthropicRequest {
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
              ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join('\n') ?? '';
      system = system ? `${system}\n${text}` : text;
      continue;
    }

    if (msg.role === 'tool') {
      const lastMsg = messages[messages.length - 1];
      const toolResultBlock: AnthropicContentBlock = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id!,
        content: typeof msg.content === 'string' ? msg.content : '',
      };

      if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
        (lastMsg.content as AnthropicContentBlock[]).push(toolResultBlock);
      } else {
        messages.push({ role: 'user', content: [toolResultBlock] });
      }
      continue;
    }

    if (msg.role === 'user') {
      messages.push(convertOpenAIUserToAnthropic(msg));
      continue;
    }

    if (msg.role === 'assistant') {
      messages.push(convertOpenAIAssistantToAnthropic(msg));
    }
  }

  const result: AnthropicRequest = {
    model: req.model,
    max_tokens: req.max_tokens ?? req.max_completion_tokens ?? 4096,
    messages,
    stream: req.stream,
  };

  if (system) result.system = system;
  if (req.temperature != null) result.temperature = req.temperature;
  if (req.top_p != null) result.top_p = req.top_p;
  if (req.stop?.length) result.stop_sequences = req.stop;
  if (req.user) result.metadata = { user_id: req.user };

  if (req.tools?.length) {
    result.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as AnthropicRequest['tools'] extends (infer T)[] ? T extends { input_schema: infer S } ? S : never : never,
    }));
  }

  return result;
}

function convertOpenAIUserToAnthropic(msg: OpenAIMessage): AnthropicMessage {
  if (typeof msg.content === 'string') {
    return { role: 'user', content: msg.content };
  }

  if (!msg.content || msg.content.length === 0) {
    return { role: 'user', content: '' };
  }

  const blocks: AnthropicContentBlock[] = [];
  for (const part of msg.content) {
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'image_url') {
      const parsed = parseDataURL(part.image_url.url);
      if (parsed) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
        });
      }
    }
  }

  return { role: 'user', content: blocks };
}

function convertOpenAIAssistantToAnthropic(msg: OpenAIMessage): AnthropicMessage {
  const blocks: AnthropicContentBlock[] = [];

  if (msg.content) {
    const text = typeof msg.content === 'string' ? msg.content : '';
    if (text) blocks.push({ type: 'text', text });
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = { raw: tc.function.arguments };
      }
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: '' });
  }

  return { role: 'assistant', content: blocks };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDataURL(url: string): { mediaType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}
