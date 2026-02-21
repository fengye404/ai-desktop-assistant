import type { ToolExecutor } from '../../tool-executor';
import type { ChatMessage, ModelConfig, Provider, StreamChunk } from '../../types';

export interface ProviderStreamContext {
  config: ModelConfig;
  messageHistory: ChatMessage[];
  abortSignal: AbortSignal | null;
  systemPrompt?: string;
  toolsEnabled: boolean;
  toolExecutor: ToolExecutor;
}

export interface ProviderStreamAdapter {
  readonly provider: Provider;
  createStream(context: ProviderStreamContext): AsyncGenerator<StreamChunk, void, unknown>;
}
