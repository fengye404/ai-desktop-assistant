import type { ToolCallRecord } from './tool';

export type MessageRole = 'user' | 'assistant';

export type ChunkType =
  | 'text'
  | 'thinking'
  | 'error'
  | 'done'
  | 'usage'
  | 'tool_use'
  | 'tool_start'
  | 'tool_input_delta'
  | 'tool_result'
  | 'processing';

export type MessageItem =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCall: ToolCallRecord };

export interface ChatImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  attachments?: ChatImageAttachment[];
  items?: MessageItem[];
  timestamp?: number;
}

export interface StreamChunk {
  type: ChunkType;
  content: string;
  usage?: StreamUsageInfo;
  toolUse?: ToolUseInfo;
  toolUseComplete?: boolean;
  toolInputDelta?: ToolInputDeltaInfo;
}

export interface StreamUsageInfo {
  inputTokens: number;
  outputTokens: number;
  contextWindowTokens?: number;
  contextUsedTokens?: number;
  contextRemainingTokens?: number;
  contextRemainingPercent?: number;
}

export interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolInputDeltaInfo {
  id: string;
  name: string;
  delta: string;
  accumulated: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

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

export interface RewindHistoryResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  removedMessageCount: number;
  remainingMessageCount: number;
}

export interface PathAutocompleteItem {
  value: string;
  isDirectory: boolean;
}
