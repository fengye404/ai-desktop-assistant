export type Provider = 'anthropic' | 'openai';

export interface ModelConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  description: string;
  protocol: Provider;
  baseURL?: string;
  apiKey: string;
  models: string[];
}

export interface ModelProvidersConfig {
  activeProviderId: string | null;
  activeModelId: string | null;
  providers: ModelProvider[];
}
