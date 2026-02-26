# 协议转换层设计文档

> 创建日期: 2026-02-26  
> 状态: 进行中

## 概述

协议转换层是一个运行在 Electron 主进程内的轻量 HTTP 反向代理，接收 Anthropic Messages API 格式的请求，转换为 OpenAI Chat Completions API 格式后转发给 OpenAI 兼容的 Provider，再将响应转换回 Anthropic 格式。

Claude Agent SDK 通过 `ANTHROPIC_BASE_URL` 连接此代理，从而透明地使用 OpenAI 兼容的模型。

## 设计原则

1. **无损转换**: 尽量保留所有协议字段，对无法映射的字段做合理降级并记录日志
2. **中间格式解耦**: 通过 `UnifiedMessage` 中间格式隔离两端，便于扩展
3. **模块化**: 消息、工具、流式三大转换器各自独立，职责单一
4. **可测试**: 每个 Transformer 可独立单测

## 架构

```
Agent SDK --[Anthropic /v1/messages]--> ProxyServer
  --> MessageTransformer.anthropicToOpenAI()
  --> ToolTransformer.anthropicToOpenAI()
  --> HTTP fetch --> OpenAI Provider (/v1/chat/completions)
  --> StreamTransformer.openAIToAnthropic()  (流式)
  --> SSE 响应 (Anthropic 格式) --> Agent SDK
```

## 文件结构

```
src/ai/protocol-translator/
├── index.ts                    # 模块入口，代理服务器生命周期管理
├── types.ts                    # 中间类型定义
├── proxy-server.ts             # HTTP 反向代理服务器
├── transformers/
│   ├── message-transformer.ts  # 消息格式双向转换
│   ├── tool-transformer.ts     # 工具定义 + 调用格式双向转换
│   └── stream-transformer.ts   # SSE 流式响应格式转换
└── __tests__/
    ├── message-transformer.test.ts
    ├── tool-transformer.test.ts
    └── stream-transformer.test.ts
```

## 中间类型定义 (types.ts)

```typescript
// 统一消息格式，作为 Anthropic ↔ OpenAI 转换的中间层
interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: UnifiedToolCall[];
  toolCallId?: string;
  thinking?: { content: string; signature?: string };
}

interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

interface UnifiedRequest {
  model: string;
  messages: UnifiedMessage[];
  tools?: UnifiedTool[];
  maxTokens?: number;
  temperature?: number;
  stream: boolean;
  system?: string;
  thinking?: { enabled: boolean; budgetTokens?: number };
}

interface UnifiedStreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'done' | 'usage';
  content?: string;
  toolCall?: UnifiedToolCall;
  thinkingContent?: string;
  stopReason?: string;
  usage?: { inputTokens: number; outputTokens: number };
}
```

## 转换对照表

### 请求转换 (Anthropic → OpenAI)

#### 顶层字段

| Anthropic | OpenAI | 转换逻辑 |
|-----------|--------|----------|
| `model` | `model` | 直通（可配置映射表） |
| `max_tokens` | `max_tokens` / `max_completion_tokens` | 直通 |
| `system` (顶层) | `messages[0] = {role:"system", content}` | 提取为首条消息 |
| `temperature` | `temperature` | 直通 |
| `stream: true` | `stream: true` | 直通 |
| `tools` | `tools` | 通过 ToolTransformer 转换 |
| `messages` | `messages` | 通过 MessageTransformer 转换 |
| `metadata.user_id` | `user` | 映射 |

#### 消息格式

| Anthropic 消息 | OpenAI 消息 |
|----------------|-------------|
| `{role:"user", content:[{type:"text", text}]}` | `{role:"user", content: text}` (单文本简化) |
| `{role:"user", content:[{type:"image", source:{type:"base64", data, media_type}}]}` | `{role:"user", content:[{type:"image_url", image_url:{url:"data:${media_type};base64,${data}"}}]}` |
| `{role:"assistant", content:[{type:"text", text}, {type:"tool_use", id, name, input}]}` | `{role:"assistant", content: text, tool_calls:[{id, type:"function", function:{name, arguments: JSON.stringify(input)}}]}` |
| `{role:"user", content:[{type:"tool_result", tool_use_id, content}]}` | `{role:"tool", tool_call_id, content}` |
| `{type:"thinking", thinking}` | 忽略或映射为 `reasoning_content`（按 provider 能力） |

#### 工具定义

| Anthropic | OpenAI |
|-----------|--------|
| `{name, description, input_schema: {type:"object", properties, required}}` | `{type:"function", function:{name, description, parameters: {type:"object", properties, required}}}` |

#### 工具调用

| Anthropic (assistant 消息中) | OpenAI (assistant 消息中) |
|------------------------------|---------------------------|
| `{type:"tool_use", id, name, input}` | `tool_calls: [{id, type:"function", function:{name, arguments}}]` |

#### 工具结果

| Anthropic | OpenAI |
|-----------|--------|
| `{role:"user", content:[{type:"tool_result", tool_use_id, content, is_error}]}` | `{role:"tool", tool_call_id, content}` |

### 响应转换 (OpenAI 流式 → Anthropic SSE)

#### SSE 事件映射

OpenAI 流式 chunk 需要组装为 Anthropic SSE 事件序列：

```
// Anthropic SSE 事件序列
event: message_start
data: {"type":"message_start","message":{"id":"msg_...","type":"message","role":"assistant","content":[],"model":"...","usage":{"input_tokens":N}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

// 工具调用
event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_...","name":"...","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":N}}

event: message_stop
data: {"type":"message_stop"}
```

#### stop_reason 映射

| OpenAI `finish_reason` | Anthropic `stop_reason` |
|------------------------|------------------------|
| `stop` | `end_turn` |
| `tool_calls` | `tool_use` |
| `length` | `max_tokens` |
| `content_filter` | `end_turn` (降级) |

#### Usage 映射

| OpenAI | Anthropic |
|--------|-----------|
| `prompt_tokens` | `input_tokens` |
| `completion_tokens` | `output_tokens` |

## 代理服务器 (proxy-server.ts)

使用 Node.js 内置 `http` 模块创建服务器，监听 `127.0.0.1` 上的随机可用端口。

### 生命周期

```typescript
interface ProxyServerOptions {
  targetBaseURL: string;  // OpenAI 兼容 provider 的 baseURL
  targetApiKey: string;   // provider 的 API key
  modelMapping?: Record<string, string>;  // 可选模型名映射
}

// 启动代理，返回本地地址
async function startProxyServer(options: ProxyServerOptions): Promise<{ port: number; stop: () => void }>;
```

### 请求处理流程

1. 接收 `POST /v1/messages` (Anthropic 格式)
2. 解析请求体为 JSON
3. `MessageTransformer.anthropicToOpenAI()` 转换消息
4. `ToolTransformer.anthropicToOpenAI()` 转换工具定义
5. 组装 OpenAI `POST /v1/chat/completions` 请求
6. 如果 `stream: true`:
   - 将 OpenAI SSE 流通过 `StreamTransformer.openAIToAnthropic()` 逐 chunk 转换
   - 以 Anthropic SSE 格式输出
7. 如果非流式:
   - 将 OpenAI JSON 响应转换为 Anthropic JSON 响应

## 边缘情况处理

### 图片附件
- Anthropic: `{type:"image", source:{type:"base64", media_type, data}}`
- OpenAI: `{type:"image_url", image_url:{url:"data:${media_type};base64,${data}"}}`

### Thinking / Extended Thinking
- Anthropic: `{type:"thinking", thinking:"..."}`
- OpenAI: 部分 provider 支持 `reasoning_content`，不支持的忽略
- 转换策略: 尝试映射，失败则静默忽略

### 多个工具调用
- Anthropic: 每个 tool_use 是独立的 content block
- OpenAI: 所有 tool_calls 在一个数组中
- 转换时需要维护 content block index

### 空 content
- Anthropic 允许 assistant 消息只有 tool_use 没有 text
- OpenAI 的 assistant content 可以为 null
- 转换时 content 为空则设为 null

## 参考资料

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
- [@musistudio/llms Transformer 架构](https://github.com/musistudio/claude-code-router)
- [claude-code-router Transformer 文档](https://musistudio.github.io/claude-code-router/docs/server/config/transformers/)
