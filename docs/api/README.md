# API 参考

本文档描述 AI Desktop Assistant 的 IPC 通信接口和类型定义。

## IPC 通道

### 渲染进程 → 主进程

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `send-message` | message, systemPrompt? | string | 发送消息并获取完整响应 |
| `send-message-stream` | message, systemPrompt? | boolean | 发送消息并流式接收响应 |
| `abort-stream` | - | void | 取消当前流式响应 |
| `set-model-config` | Partial\<ModelConfig\> | boolean | 设置模型配置 |
| `test-connection` | - | {success, message} | 测试 API 连接 (15秒超时) |
| `encrypt-data` | data | string | 加密敏感数据 |
| `decrypt-data` | encryptedData | string | 解密敏感数据 |
| `clear-history` | - | void | 清除对话历史 |
| `get-history` | - | ChatMessage[] | 获取对话历史 |

### 主进程 → 渲染进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `stream-chunk` | StreamChunk | 流式响应数据块 |

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

对话消息结构：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}
```

### StreamChunk

流式响应数据块：

```typescript
interface StreamChunk {
  type: 'text' | 'thinking' | 'error' | 'done';
  content: string;
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

暴露给渲染进程的 API 接口：

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
  testConnection: () => Promise<ConnectionTestResult>;
  
  // 加密相关
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;
  
  // 对话历史
  clearHistory: () => Promise<void>;
  getHistory: () => Promise<ChatMessage[]>;
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
