# API 参考

本文档描述 AI Desktop Assistant 的 IPC 通信接口和类型定义。

## IPC 通道

### 渲染进程 → 主进程

#### 消息相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `send-message` | message, systemPrompt?, attachments? | string | 发送消息并获取完整响应 |
| `send-message-stream` | message, systemPrompt?, attachments? | boolean | 发送消息并流式接收响应 |
| `abort-stream` | - | void | 取消当前流式响应 |
| `clear-history` | - | void | 清除对话历史（SDK 管理，当前为 no-op） |
| `get-history` | - | ChatMessage[] | 获取当前会话的消息历史 |
| `compact-history` | - | CompactHistoryResult | 压缩对话历史（SDK 自动管理） |
| `rewind-last-turn` | - | RewindHistoryResult | 撤销最后一轮（SDK 管理） |
| `autocomplete-paths` | partialPath | PathAutocompleteItem[] | @ 路径自动补全 |

#### 配置相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `set-model-config` | Partial\<ModelConfig\> | boolean | 设置当前模型配置到 AgentService |
| `config-save` | ModelProvidersConfig | boolean | 保存提供商配置到 SQLite |
| `config-load` | - | ModelProvidersConfig | 从 SQLite 加载提供商配置 |
| `test-connection` | - | ConnectionTestResult | 测试 API 连接 |

#### 加密相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `encrypt-data` | data | string | 使用 safeStorage 加密 |
| `decrypt-data` | encryptedData | string | 使用 safeStorage 解密 |

#### 会话管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `session-list` | - | SessionMeta[] | 获取会话列表（过滤本应用会话） |
| `session-get` | id | Session \| null | 获取指定会话及消息 |
| `session-create` | title? | Session | 创建新会话 |
| `session-delete` | id | boolean | 软删除会话 |
| `session-switch` | id | Session \| null | 切换到指定会话并加载消息 |
| `session-rename` | id, title | boolean | 重命名会话 |

#### MCP 管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `mcp-list-servers` | - | McpServerStatus[] | 获取 MCP 服务器列表 |
| `mcp-list-tools` | - | McpToolInfo[] | 获取 MCP 工具列表 |
| `mcp-refresh` | - | McpRefreshResult | 刷新 MCP 状态 |
| `mcp-upsert-server` | name, config | McpRefreshResult | 添加或更新 MCP 服务器 |
| `mcp-remove-server` | name | McpRefreshResult | 移除 MCP 服务器 |

### 主进程 → 渲染进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `stream-chunk` | StreamChunk | 流式响应数据块 |
| `tool-approval-request` | ToolApprovalRequest | 工具执行审批请求 |

### 渲染进程 → 主进程（单向）

| 通道 | 参数 | 说明 |
|------|------|------|
| `tool-approval-response` | ToolApprovalResponse | 工具审批结果 |

## 类型定义

### ModelConfig

模型配置（内部，AgentService 使用）：

```typescript
interface ModelConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}
```

### ModelProvidersConfig

多提供商配置（持久化存储）：

```typescript
interface ModelProvider {
  id: string;
  name: string;
  description: string;
  protocol: 'anthropic' | 'openai';
  baseURL?: string;
  apiKey: string;
  models: string[];
}

interface ModelProvidersConfig {
  activeProviderId: string | null;
  activeModelId: string | null;
  providers: ModelProvider[];
}
```

### ChatMessage

对话消息结构，支持文本和工具调用穿插：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatImageAttachment[];
  items?: MessageItem[];
  timestamp?: number;
}

type MessageItem =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCall: ToolCallRecord };
```

### StreamChunk

流式响应数据块：

```typescript
type ChunkType =
  | 'text'
  | 'thinking'
  | 'error'
  | 'done'
  | 'tool_use'
  | 'tool_start'
  | 'tool_input_delta'
  | 'tool_result'
  | 'processing';

interface StreamChunk {
  type: ChunkType;
  content: string;
  toolUse?: ToolUseInfo;
  toolUseComplete?: boolean;
  toolInputDelta?: ToolInputDeltaInfo;
}

interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolInputDeltaInfo {
  id: string;
  name: string;
  delta: string;
  accumulated: string;
}
```

### ToolCallRecord

工具调用记录：

```typescript
type ToolCallStatus = 'pending' | 'queued' | 'running' | 'success' | 'error';

interface ToolCallRecord {
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
```

### ToolApprovalRequest & Response

工具审批（SDK canUseTool 回调驱动）：

```typescript
interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
  toolUseID: string;
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionSuggestion[];
}

interface ToolApprovalResponse {
  approved: boolean;
  updatedPermissions?: PermissionSuggestion[];
}

type PermissionSuggestion = {
  type: string;
  rules?: unknown[];
  behavior?: string;
  destination?: string;
  mode?: string;
  directories?: string[];
};
```

### Session & SessionMeta

```typescript
interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}
```

### MCP 相关类型

```typescript
type McpServerTransport = 'stdio' | 'streamable-http' | 'sse';

interface McpServerConfig {
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

interface McpServerStatus {
  name: string;
  transport: McpServerTransport;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
  lastError?: string;
}

interface McpToolInfo {
  alias: string;
  originalName: string;
  server: string;
  description: string;
}
```

## ElectronAPI

渲染进程可用的完整 API 接口：

```typescript
interface ElectronAPI {
  // 消息
  sendMessage: (message: string, systemPrompt?: string, attachments?: ChatImageAttachment[]) => Promise<string>;
  sendMessageStream: (message: string, systemPrompt?: string, attachments?: ChatImageAttachment[]) => Promise<boolean>;
  abortStream: () => Promise<void>;

  // 流式监听
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => void;
  removeStreamListener: () => void;

  // 配置
  setModelConfig: (config: Partial<ModelConfig>) => Promise<boolean>;
  configSave: (config: ModelProvidersConfig) => Promise<boolean>;
  configLoad: () => Promise<ModelProvidersConfig>;
  testConnection: () => Promise<ConnectionTestResult>;

  // 加密
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;

  // 历史
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<ChatMessage[]>;
  compactHistory: () => Promise<CompactHistoryResult>;
  rewindLastTurn: () => Promise<RewindHistoryResult>;

  // 路径补全
  autocompletePaths: (partialPath: string) => Promise<PathAutocompleteItem[]>;

  // 会话
  sessionList: () => Promise<SessionMeta[]>;
  sessionGet: (id: string) => Promise<Session | null>;
  sessionCreate: (title?: string) => Promise<Session>;
  sessionDelete: (id: string) => Promise<boolean>;
  sessionSwitch: (id: string) => Promise<Session | null>;
  sessionRename: (id: string, title: string) => Promise<boolean>;

  // MCP
  mcpListServers: () => Promise<McpServerStatus[]>;
  mcpListTools: () => Promise<McpToolInfo[]>;
  mcpRefresh: () => Promise<McpRefreshResult>;
  mcpUpsertServer: (name: string, config: McpServerConfig) => Promise<McpRefreshResult>;
  mcpRemoveServer: (name: string) => Promise<McpRefreshResult>;

  // 工具审批
  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => void;
  respondToolApproval: (response: ToolApprovalResponse) => void;
}
```

## 错误类型

| 错误类 | 说明 |
|--------|------|
| `AppError` | 应用错误基类 |
| `APIKeyError` | API 密钥缺失或无效 |
| `APIRequestError` | API 请求失败 |
| `StreamAbortedError` | 流式响应被用户取消 |
| `EncryptionError` | 加密/解密失败 |
| `ConfigError` | 配置错误 |
| `ServiceNotInitializedError` | 服务未初始化 |
