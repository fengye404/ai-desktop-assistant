/**
 * Bidirectional tool definition / tool call transformer:
 * Anthropic tool format ↔ OpenAI function-calling format.
 */

import type {
  AnthropicToolDef,
  OpenAIToolDef,
} from '../types';

// ---------------------------------------------------------------------------
// Tool Definitions: Anthropic → OpenAI
// ---------------------------------------------------------------------------

export function anthropicToolsToOpenAI(tools: AnthropicToolDef[]): OpenAIToolDef[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ---------------------------------------------------------------------------
// Tool Definitions: OpenAI → Anthropic
// ---------------------------------------------------------------------------

export function openAIToolsToAnthropic(tools: OpenAIToolDef[]): AnthropicToolDef[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as AnthropicToolDef['input_schema'],
  }));
}

// ---------------------------------------------------------------------------
// Stop Reason mapping
// ---------------------------------------------------------------------------

export function openAIFinishReasonToAnthropic(
  reason: string | null,
): 'end_turn' | 'tool_use' | 'max_tokens' {
  switch (reason) {
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'stop':
    default:
      return 'end_turn';
  }
}

export function anthropicStopReasonToOpenAI(
  reason: string | null,
): 'stop' | 'tool_calls' | 'length' {
  switch (reason) {
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    case 'end_turn':
    default:
      return 'stop';
  }
}
