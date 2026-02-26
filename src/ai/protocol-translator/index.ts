/**
 * Protocol Translator — Module entry point.
 *
 * Manages the lifecycle of a local HTTP proxy that translates between
 * Anthropic Messages API and OpenAI Chat Completions API, allowing
 * the Claude Agent SDK to work with OpenAI-compatible providers.
 *
 * Usage:
 *   const handle = await startTranslatorProxy({
 *     targetBaseURL: 'https://api.openai.com/v1',
 *     targetApiKey: 'sk-...',
 *   });
 *   // Set ANTHROPIC_BASE_URL to handle.baseURL before calling SDK query()
 *   // ...
 *   await handle.stop();
 */

export { startProxyServer } from './proxy-server';
export type { ProxyServerOptions, ProxyServerHandle } from './proxy-server';

export {
  anthropicRequestToOpenAI,
  openAIRequestToAnthropic,
} from './transformers/message-transformer';

export {
  anthropicToolsToOpenAI,
  openAIToolsToAnthropic,
  openAIFinishReasonToAnthropic,
  anthropicStopReasonToOpenAI,
} from './transformers/tool-transformer';

export {
  OpenAIToAnthropicStreamTransformer,
  parseOpenAISSELine,
} from './transformers/stream-transformer';

export type {
  UnifiedMessage,
  UnifiedContentBlock,
  UnifiedThinking,
  UnifiedToolCall,
  UnifiedTool,
  UnifiedRequest,
  UnifiedStreamChunk,
  UnifiedUsage,
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicToolDef,
  OpenAIRequest,
  OpenAIMessage,
  OpenAIContentPart,
  OpenAIToolCallWire,
  OpenAIToolDef,
  OpenAIStreamChunk,
} from './types';
