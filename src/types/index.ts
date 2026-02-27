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
 * Tool call status
 */
export type ToolCallStatus = 'pending' | 'queued' | 'running' | 'success' | 'error';

/**
 * Tool call record for persistence
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  inputText?: string;
  inputStreaming?: boolean;
  output?: string;
  error?: string;
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionSuggestion[];
}

/**
 * Message content item - can be text or tool call
 */
export type MessageItem = 
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCall: ToolCallRecord };

/**
 * Image attachment for user messages
 */
export interface ChatImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

/**
 * Chat message structure for conversation history
 * Supports both legacy format (content string) and new format (items array)
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;  // For backward compatibility and simple text
  attachments?: ChatImageAttachment[];
  items?: MessageItem[];  // New format with tool calls
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
export type ChunkType =
  | 'text'
  | 'thinking'
  | 'error'
  | 'done'
  | 'tool_use'
  | 'tool_start'
  | 'tool_input_delta'
  | 'tool_result'
  | 'processing';

/**
 * Model configuration for AI providers (internal, used by AgentService)
 */
export interface ModelConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

/**
 * Model provider (供应商) with name, description, protocol, baseURL, and apiKey
 */
export interface ModelProvider {
  id: string;
  name: string;
  description: string;
  protocol: Provider;
  baseURL?: string;
  apiKey: string;
  models: string[];
}

/**
 * Persistent model providers configuration
 */
export interface ModelProvidersConfig {
  activeProviderId: string | null;
  activeModelId: string | null;
  providers: ModelProvider[];
}

/**
 * Stream chunk data structure
 */
export interface StreamChunk {
  type: ChunkType;
  content: string;
  toolUse?: ToolUseInfo;
  toolUseComplete?: boolean;
  toolInputDelta?: ToolInputDeltaInfo;
}

/**
 * Tool use information in stream
 */
export interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Streaming tool input delta payload
 */
export interface ToolInputDeltaInfo {
  id: string;
  name: string;
  delta: string;
  accumulated: string;
}

// ==================== Tool Approval Types ====================

/**
 * SDK permission suggestion — forwarded from the SDK's canUseTool callback.
 * When returned as updatedPermissions, the SDK permanently adds the rule
 * so the user is never prompted for this particular action again.
 */
export type PermissionSuggestion = {
  type: string;
  rules?: unknown[];
  behavior?: string;
  destination?: string;
  mode?: string;
  directories?: string[];
};

/**
 * Tool approval request to renderer (from SDK canUseTool callback)
 */
export interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
  toolUseID: string;
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionSuggestion[];
}

/**
 * Tool approval response from renderer — now structured.
 */
export interface ToolApprovalResponse {
  approved: boolean;
  updatedPermissions?: PermissionSuggestion[];
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

/**
 * History compaction result
 */
export interface CompactHistoryResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  beforeMessageCount: number;
  afterMessageCount: number;
  removedMessageCount: number;
  beforeEstimatedTokens: number;
  afterEstimatedTokens: number;
}

/**
 * History rewind result
 */
export interface RewindHistoryResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  removedMessageCount: number;
  remainingMessageCount: number;
}

/**
 * Path autocomplete item for @ reference input
 */
export interface PathAutocompleteItem {
  value: string;
  isDirectory: boolean;
}

/**
 * MCP server transport type
 */
export type McpServerTransport = 'stdio' | 'streamable-http' | 'sse';

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  transport?: McpServerTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  cwd?: string;
  url?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

/**
 * MCP servers configuration map
 */
export type McpServersConfig = Record<string, McpServerConfig>;

/**
 * MCP server runtime status
 */
export interface McpServerStatus {
  name: string;
  transport: McpServerTransport;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
  lastError?: string;
  command?: string;
  args?: string[];
  url?: string;
}

/**
 * MCP tool metadata exposed to renderer
 */
export interface McpToolInfo {
  alias: string;
  originalName: string;
  server: string;
  description: string;
}

/**
 * MCP refresh operation result
 */
export interface McpRefreshResult {
  servers: McpServerStatus[];
  tools: McpToolInfo[];
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
  COMPACT_HISTORY: 'compact-history',
  REWIND_LAST_TURN: 'rewind-last-turn',
  AUTOCOMPLETE_PATHS: 'autocomplete-paths',

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

  // MCP management
  MCP_LIST_SERVERS: 'mcp-list-servers',
  MCP_LIST_TOOLS: 'mcp-list-tools',
  MCP_REFRESH: 'mcp-refresh',
  MCP_UPSERT_SERVER: 'mcp-upsert-server',
  MCP_REMOVE_SERVER: 'mcp-remove-server',

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
  sendMessage: (message: string, systemPrompt?: string, attachments?: ChatImageAttachment[]) => Promise<string>;
  sendMessageStream: (
    message: string,
    systemPrompt?: string,
    attachments?: ChatImageAttachment[],
  ) => Promise<boolean>;
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => void;
  removeStreamListener: () => void;
  setModelConfig: (config: Partial<ModelConfig>) => Promise<boolean>;
  testConnection: () => Promise<ConnectionTestResult>;
  abortStream: () => Promise<void>;
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<ChatMessage[]>;
  compactHistory: () => Promise<CompactHistoryResult>;
  rewindLastTurn: () => Promise<RewindHistoryResult>;
  autocompletePaths: (partialPath: string) => Promise<PathAutocompleteItem[]>;

  // Session management
  sessionList: () => Promise<SessionMeta[]>;
  sessionGet: (id: string) => Promise<Session | null>;
  sessionCreate: (title?: string) => Promise<Session>;
  sessionDelete: (id: string) => Promise<boolean>;
  sessionSwitch: (id: string) => Promise<Session | null>;
  sessionRename: (id: string, title: string) => Promise<boolean>;

  // Config management
  configSave: (config: ModelProvidersConfig) => Promise<boolean>;
  configLoad: () => Promise<ModelProvidersConfig>;

  // MCP management
  mcpListServers: () => Promise<McpServerStatus[]>;
  mcpListTools: () => Promise<McpToolInfo[]>;
  mcpRefresh: () => Promise<McpRefreshResult>;
  mcpUpsertServer: (name: string, config: McpServerConfig) => Promise<McpRefreshResult>;
  mcpRemoveServer: (name: string) => Promise<McpRefreshResult>;

  // Tool system
  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => void;
  respondToolApproval: (response: ToolApprovalResponse) => void;
}

/**
 * Augment Window interface with electronAPI
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
