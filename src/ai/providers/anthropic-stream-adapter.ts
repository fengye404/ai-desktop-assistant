import Anthropic from '@anthropic-ai/sdk';
import { streamAnthropicWithTools } from '../provider-streams';
import type { StreamChunk } from '../../types';
import type { ProviderStreamAdapter, ProviderStreamContext } from './provider-stream-adapter';

interface AnthropicStreamAdapterDependencies {
  getClient: () => Anthropic;
  isFineGrainedToolStreamingEnabled: () => boolean;
  disableFineGrainedToolStreaming: () => void;
}

export class AnthropicStreamAdapter implements ProviderStreamAdapter {
  readonly provider = 'anthropic' as const;

  constructor(private readonly dependencies: AnthropicStreamAdapterDependencies) {}

  createStream(context: ProviderStreamContext): AsyncGenerator<StreamChunk, void, unknown> {
    return streamAnthropicWithTools({
      client: this.dependencies.getClient(),
      config: context.config,
      messageHistory: context.messageHistory,
      toolExecutor: context.toolExecutor,
      toolsEnabled: context.toolsEnabled,
      abortSignal: context.abortSignal,
      systemPrompt: context.systemPrompt,
      fineGrainedToolStreamingEnabled: this.dependencies.isFineGrainedToolStreamingEnabled(),
      disableFineGrainedToolStreaming: this.dependencies.disableFineGrainedToolStreaming,
    });
  }
}
