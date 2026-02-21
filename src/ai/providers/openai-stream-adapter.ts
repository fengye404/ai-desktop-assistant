import OpenAI from 'openai';
import { streamOpenAICompatible } from '../provider-streams';
import type { StreamChunk } from '../../types';
import type { ProviderStreamAdapter, ProviderStreamContext } from './provider-stream-adapter';

interface OpenAIStreamAdapterDependencies {
  getClient: () => OpenAI;
}

export class OpenAIStreamAdapter implements ProviderStreamAdapter {
  readonly provider = 'openai' as const;

  constructor(private readonly dependencies: OpenAIStreamAdapterDependencies) {}

  createStream(context: ProviderStreamContext): AsyncGenerator<StreamChunk, void, unknown> {
    return streamOpenAICompatible({
      client: this.dependencies.getClient(),
      config: context.config,
      messageHistory: context.messageHistory,
      abortSignal: context.abortSignal,
      systemPrompt: context.systemPrompt,
    });
  }
}
