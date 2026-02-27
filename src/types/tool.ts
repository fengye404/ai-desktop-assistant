export type ToolCallStatus = 'pending' | 'queued' | 'running' | 'success' | 'error';

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

export type PermissionSuggestion = {
  type: string;
  rules?: unknown[];
  behavior?: string;
  destination?: string;
  mode?: string;
  directories?: string[];
};

export interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
  toolUseID: string;
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionSuggestion[];
}

export interface ToolApprovalResponse {
  approved: boolean;
  updatedPermissions?: PermissionSuggestion[];
}
