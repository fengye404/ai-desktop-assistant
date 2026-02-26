/**
 * Unified intermediate types for Anthropic ↔ OpenAI protocol translation.
 *
 * These types decouple the two API formats so each transformer only needs
 * to know about "Unified ↔ its own format".
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null | UnifiedContentBlock[];
  toolCalls?: UnifiedToolCall[];
  toolCallId?: string;
  thinking?: UnifiedThinking;
}

export type UnifiedContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string };

export interface UnifiedThinking {
  content: string;
  signature?: string;
}

// ---------------------------------------------------------------------------
// Tool calls & definitions
// ---------------------------------------------------------------------------

export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface UnifiedRequest {
  model: string;
  messages: UnifiedMessage[];
  tools?: UnifiedTool[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream: boolean;
  system?: string;
  thinking?: { enabled: boolean; budgetTokens?: number };
  stopSequences?: string[];
  metadata?: { userId?: string };
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export type UnifiedStreamChunkType =
  | 'message_start'
  | 'text'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'thinking'
  | 'done'
  | 'usage';

export interface UnifiedStreamChunk {
  type: UnifiedStreamChunkType;
  content?: string;
  toolCall?: Partial<UnifiedToolCall>;
  thinkingContent?: string;
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens';
  usage?: UnifiedUsage;
  messageId?: string;
  model?: string;
  contentBlockIndex?: number;
}

export interface UnifiedUsage {
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Anthropic-specific wire types (subset needed for conversion)
// ---------------------------------------------------------------------------

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string | AnthropicContentBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicToolDef[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  metadata?: { user_id?: string };
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | AnthropicContentBlock[]; is_error?: boolean }
  | { type: 'thinking'; thinking: string; signature?: string };

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// OpenAI-specific wire types (subset needed for conversion)
// ---------------------------------------------------------------------------

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAIToolDef[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  stop?: string[];
  user?: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null | OpenAIContentPart[];
  tool_calls?: OpenAIToolCallWire[];
  tool_call_id?: string;
}

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

export interface OpenAIToolCallWire {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
