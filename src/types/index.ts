/**
 * Centralized type definitions for AI Desktop Assistant
 */

/**
 * Supported AI providers
 */
export type Provider = 'anthropic' | 'openai';

/**
 * Message role type
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Chat message structure for conversation history
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

/**
 * Session structure for storing conversation sessions
 */
export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Session metadata for list display (without full messages)
 */
export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

/**
 * Stream chunk types
 */
export type ChunkType = 'text' | 'thinking' | 'error' | 'done' | 'tool_use' | 'tool_result';

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
  toolUse?: ToolUseInfo;
}

/**
 * Tool use information in stream
 */
export interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ==================== Tool System Types ====================

/**
 * Permission level for tool execution
 */
export type ToolPermission = 'allow' | 'ask' | 'deny';

/**
 * Tool definition following Anthropic's schema
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  permission: ToolPermission;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Tool use request from AI
 */
export interface ToolUseRequest {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool approval request to renderer
 */
export interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
}

/**
 * Tool approval response from renderer
 */
export interface ToolApprovalResponse {
  approved: boolean;
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
  CLEAR_HISTORY: 'clear-history',
  GET_HISTORY: 'get-history',

  // Session management
  SESSION_LIST: 'session-list',
  SESSION_GET: 'session-get',
  SESSION_CREATE: 'session-create',
  SESSION_DELETE: 'session-delete',
  SESSION_SWITCH: 'session-switch',
  SESSION_RENAME: 'session-rename',

  // Config management
  CONFIG_SAVE: 'config-save',
  CONFIG_LOAD: 'config-load',

  // Tool system
  TOOL_APPROVAL_REQUEST: 'tool-approval-request',
  TOOL_APPROVAL_RESPONSE: 'tool-approval-response',

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
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<ChatMessage[]>;

  // Session management
  sessionList: () => Promise<SessionMeta[]>;
  sessionGet: (id: string) => Promise<Session | null>;
  sessionCreate: (title?: string) => Promise<Session>;
  sessionDelete: (id: string) => Promise<boolean>;
  sessionSwitch: (id: string) => Promise<Session | null>;
  sessionRename: (id: string, title: string) => Promise<boolean>;

  // Config management
  configSave: (config: Partial<ModelConfig>) => Promise<boolean>;
  configLoad: () => Promise<Partial<ModelConfig>>;

  // Tool system
  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => void;
  respondToolApproval: (approved: boolean) => void;
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
