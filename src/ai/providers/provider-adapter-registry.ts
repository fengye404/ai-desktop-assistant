import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { Provider } from '../../types';
import { AnthropicStreamAdapter } from './anthropic-stream-adapter';
import { OpenAIStreamAdapter } from './openai-stream-adapter';
import type { ProviderStreamAdapter } from './provider-stream-adapter';

interface ProviderAdapterRegistryDependencies {
  getAnthropicClient: () => Anthropic;
  getOpenAIClient: () => OpenAI;
  isFineGrainedToolStreamingEnabled: () => boolean;
  disableFineGrainedToolStreaming: () => void;
}

export function createProviderAdapterRegistry(
  dependencies: ProviderAdapterRegistryDependencies,
): Map<Provider, ProviderStreamAdapter> {
  return new Map<Provider, ProviderStreamAdapter>([
    [
      'anthropic',
      new AnthropicStreamAdapter({
        getClient: dependencies.getAnthropicClient,
        isFineGrainedToolStreamingEnabled: dependencies.isFineGrainedToolStreamingEnabled,
        disableFineGrainedToolStreaming: dependencies.disableFineGrainedToolStreaming,
      }),
    ],
    [
      'openai',
      new OpenAIStreamAdapter({
        getClient: dependencies.getOpenAIClient,
      }),
    ],
  ]);
}
