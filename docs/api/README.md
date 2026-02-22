# API 参考

本文档描述 AI Desktop Assistant 的 IPC 通信接口和类型定义。

## IPC 通道

### 渲染进程 → 主进程

#### 消息相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `send-message` | message, systemPrompt? | string | 发送消息并获取完整响应 |
| `send-message-stream` | message, systemPrompt? | boolean | 发送消息并流式接收响应 |
| `abort-stream` | - | void | 取消当前流式响应 |
| `clear-history` | - | void | 清除对话历史 |
| `get-history` | - | ChatMessage[] | 获取对话历史 |
| `compact-history` | - | CompactHistoryResult | 压缩对话历史 |

#### 配置相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `set-model-config` | Partial\<ModelConfig\> | boolean | 设置模型配置 |
| `config-save` | Partial\<ModelConfig\> | boolean | 保存配置到持久化存储 |
| `config-load` | - | Partial\<ModelConfig\> | 从持久化存储加载配置 |
| `test-connection` | - | {success, message} | 测试 API 连接 (15秒超时) |

#### 加密相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `encrypt-data` | data | string | 加密敏感数据 |
| `decrypt-data` | encryptedData | string | 解密敏感数据 |

#### 会话管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `session-list` | - | SessionMeta[] | 获取会话列表 |
| `session-get` | id | Session \| null | 获取指定会话 |
| `session-create` | title? | Session | 创建新会话 |
| `session-delete` | id | boolean | 删除会话 |
| `session-switch` | id | Session \| null | 切换到指定会话 |
| `session-rename` | id, title | boolean | 重命名会话 |

#### MCP 管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `mcp-list-servers` | - | McpServerStatus[] | 获取 MCP 服务器列表 |
| `mcp-list-tools` | - | McpToolInfo[] | 获取 MCP 工具列表 |
| `mcp-refresh` | - | McpRefreshResult | 刷新 MCP 服务器状态 |
| `mcp-upsert-server` | name, config | McpRefreshResult | 添加或更新 MCP 服务器 |
| `mcp-remove-server` | name | McpRefreshResult | 移除 MCP 服务器 |

#### 工具系统

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `autocomplete-paths` | partialPath | PathAutocompleteItem[] | 路径自动补全 |

### 主进程 → 渲染进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `stream-chunk` | StreamChunk | 流式响应数据块 |
| `tool-approval-request` | ToolApprovalRequest | 工具执行审批请求 |

## 类型定义

### ModelConfig

模型配置接口：

```typescript
interface ModelConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}
```

### ChatMessage

对话消息结构，支持传统格式和新格式：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;           // 用于向后兼容
  items?: MessageItem[];     // 新格式，支持工具调用穿插
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
}
```

### Session & SessionMeta

会话结构：

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
  command?: string;
  args?: string[];
  url?: string;
}

interface McpToolInfo {
  alias: string;
  originalName: string;
  server: string;
  description: string;
}

interface McpRefreshResult {
  servers: McpServerStatus[];
  tools: McpToolInfo[];
}
```

### CompactHistoryResult

历史压缩结果：

```typescript
interface CompactHistoryResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  beforeMessageCount: number;
  afterMessageCount: number;
  removedMessageCount: number;
  beforeEstimatedTokens: number;
  afterEstimatedTokens: number;
}
```

### ToolApprovalRequest & Response

工具审批：

```typescript
interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
}

interface ToolApprovalResponse {
  approved: boolean;
}
```

### ConnectionTestResult

连接测试结果：

```typescript
interface ConnectionTestResult {
  success: boolean;
  message: string;
}
```

## ElectronAPI

暴露给渲染进程的完整 API 接口：

```typescript
interface ElectronAPI {
  // 消息相关
  sendMessage: (message: string, systemPrompt?: string) => Promise<string>;
  sendMessageStream: (message: string, systemPrompt?: string) => Promise<boolean>;
  abortStream: () => Promise<void>;

  // 流式响应监听
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => void;
  removeStreamListener: () => void;

  // 配置相关
  setModelConfig: (config: Partial<ModelConfig>) => Promise<boolean>;
  configSave: (config: Partial<ModelConfig>) => Promise<boolean>;
  configLoad: () => Promise<Partial<ModelConfig>>;
  testConnection: () => Promise<ConnectionTestResult>;

  // 加密相关
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;

  // 对话历史
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<ChatMessage[]>;
  compactHistory: () => Promise<CompactHistoryResult>;

  // 路径自动补全
  autocompletePaths: (partialPath: string) => Promise<PathAutocompleteItem[]>;

  // 会话管理
  sessionList: () => Promise<SessionMeta[]>;
  sessionGet: (id: string) => Promise<Session | null>;
  sessionCreate: (title?: string) => Promise<Session>;
  sessionDelete: (id: string) => Promise<boolean>;
  sessionSwitch: (id: string) => Promise<Session | null>;
  sessionRename: (id: string, title: string) => Promise<boolean>;

  // MCP 管理
  mcpListServers: () => Promise<McpServerStatus[]>;
  mcpListTools: () => Promise<McpToolInfo[]>;
  mcpRefresh: () => Promise<McpRefreshResult>;
  mcpUpsertServer: (name: string, config: McpServerConfig) => Promise<McpRefreshResult>;
  mcpRemoveServer: (name: string) => Promise<McpRefreshResult>;

  // 工具系统
  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => void;
  respondToolApproval: (approved: boolean) => void;
}
```

## 使用示例

### 发送流式消息

```typescript
// 设置监听器
window.electronAPI.onStreamChunk((chunk) => {
  if (chunk.type === 'text') {
    console.log('收到文本:', chunk.content);
  } else if (chunk.type === 'done') {
    console.log('响应完成');
  } else if (chunk.type === 'error') {
    console.error('错误:', chunk.content);
  } else if (chunk.type === 'tool_use') {
    console.log('工具调用:', chunk.toolUse?.name);
  }
});

// 发送消息
await window.electronAPI.sendMessageStream('你好');
```

### 配置模型

```typescript
await window.electronAPI.setModelConfig({
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  apiKey: 'your-api-key',
});
```

### 会话管理

```typescript
// 获取会话列表
const sessions = await window.electronAPI.sessionList();

// 创建新会话
const newSession = await window.electronAPI.sessionCreate('新对话');

// 切换会话
await window.electronAPI.sessionSwitch(sessions[0].id);

// 重命名会话
await window.electronAPI.sessionRename(sessions[0].id, '重要讨论');
```

### MCP 管理

```typescript
// 添加 MCP 服务器
await window.electronAPI.mcpUpsertServer('filesystem', {
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@anthropic/mcp-server-filesystem', './'],
  enabled: true,
});

// 获取 MCP 工具列表
const tools = await window.electronAPI.mcpListTools();

// 刷新 MCP 状态
await window.electronAPI.mcpRefresh();
```

### 工具审批

```typescript
// 监听工具审批请求
window.electronAPI.onToolApprovalRequest((request) => {
  console.log('工具:', request.tool);
  console.log('描述:', request.description);

  // 用户确认后响应
  const approved = confirm(`允许执行 ${request.tool}？`);
  window.electronAPI.respondToolApproval(approved);
});
```

### 清除对话

```typescript
await window.electronAPI.clearHistory();
```

## 错误类型

| 错误类 | 说明 |
|--------|------|
| `APIKeyError` | API 密钥缺失或无效 |
| `APIRequestError` | API 请求失败 |
| `StreamAbortedError` | 流式响应被用户取消 |
| `EncryptionError` | 加密/解密失败 |
| `ServiceNotInitializedError` | 服务未初始化 |
