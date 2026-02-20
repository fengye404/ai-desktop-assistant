/**
 * Centralized type definitions for AI Desktop Assistant
 */

/**
 * Supported AI providers
 */
export type Provider = 'anthropic' | 'openai';

/**
 * Stream chunk types
 */
export type ChunkType = 'text' | 'thinking' | 'error' | 'done';

/**
 * Model configuration for AI providers
 */
export interface ModelConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

/**
 * Stream chunk data structure
 */
export interface StreamChunk {
  type: ChunkType;
  content: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

/**
 * IPC channel names for type safety
 */
export const IPC_CHANNELS = {
  // Renderer -> Main
  SEND_MESSAGE: 'send-message',
  SEND_MESSAGE_STREAM: 'send-message-stream',
  SET_MODEL_CONFIG: 'set-model-config',
  TEST_CONNECTION: 'test-connection',
  ABORT_STREAM: 'abort-stream',
  ENCRYPT_DATA: 'encrypt-data',
  DECRYPT_DATA: 'decrypt-data',

  // Main -> Renderer
  STREAM_CHUNK: 'stream-chunk',
} as const;

/**
 * Electron API exposed via contextBridge
 */
export interface ElectronAPI {
  sendMessage: (message: string, systemPrompt?: string) => Promise<string>;
  sendMessageStream: (message: string, systemPrompt?: string) => Promise<boolean>;
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => void;
  removeStreamListener: () => void;
  setModelConfig: (config: Partial<ModelConfig>) => Promise<boolean>;
  testConnection: () => Promise<ConnectionTestResult>;
  abortStream: () => Promise<void>;
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;
}

/**
 * Preset configuration
 */
export interface PresetConfig {
  provider: Provider;
  model: string;
  baseURL?: string;
}

/**
 * Available presets
 */
export type PresetName = 'anthropic' | 'openai' | 'ollama' | 'deepseek' | 'moonshot' | 'custom';

/**
 * Map of preset names to configurations
 */
export type PresetsMap = Record<PresetName, Partial<PresetConfig>>;

/**
 * Augment Window interface with electronAPI
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
