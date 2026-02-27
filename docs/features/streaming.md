# 流式响应

> Agent SDK 迁移后的架构 — SDK query() 驱动流式消息

## 功能概述

流式响应功能实现 AI 回复的实时显示。Agent SDK 的 `query()` 返回 `AsyncIterable<SDKMessage>`，`AgentService` 将 SDK 消息映射为应用内部的 `StreamChunk`，通过 IPC 发送到渲染层进行实时渲染。

## 数据流架构

```
Claude Agent SDK
    ↓ AsyncIterable<SDKMessage>
AgentService.mapSdkMessageToChunks()
    ↓ StreamChunk[]
Main Process (chat-handlers)
    ↓ webContents.send('stream-chunk', chunk)
Preload (ipcRenderer.on)
    ↓
chat-stream-listener.handleChunk()
    ↓ 缓冲 + 调度
chat-stream-state (pure reducers)
    ↓
chat-store (streamItems 更新)
    ↓
ChatArea UI 重渲染
```

## 核心实现

### 1. AgentService（消息映射）

SDK 消息类型到 StreamChunk 的映射：

| SDK 消息类型 | 处理方法 | 产生的 StreamChunk |
|-------------|---------|-------------------|
| `system` (init) | `handleSystemMessage` | 无（设置 sessionId） |
| `assistant` | `handleAssistantMessage` | text, tool_use, thinking |
| `stream_event` | `handleStreamEvent` | text, tool_use, tool_input_delta, thinking |
| `result` (success) | `handleResultMessage` | done |
| `result` (error) | `handleResultMessage` | error |
| `user` (tool_result) | `handleUserMessage` | tool_result |
| `tool_progress` | `handleToolProgress` | tool_start |

### 2. 主进程（IPC 转发）

```typescript
// chat-handlers.ts
const stream = service.sendMessageStream(prompt, options);
for await (const chunk of stream) {
  sendStreamChunk(context, chunk);
}
```

### 3. 渲染层管线

#### chat-stream-listener

- 接收 IPC stream-chunk 事件
- 文本 chunk 缓冲，定时刷新（减少渲染次数）
- 工具事件立即处理
- `done` 信号触发 `onDone` 回调

#### chat-stream-state（纯 reducer）

无副作用的状态转换函数：

```typescript
applyTextChunk(items, chunk)        → 追加文本到最后一个文本项
applyToolUseChunk(items, chunk)     → 添加或更新工具调用项
applyToolStartChunk(items, chunk)   → 标记工具开始执行
applyToolInputDeltaChunk(items, chunk) → 更新工具输入流式内容
applyToolResultChunk(items, chunk)  → 设置工具执行结果
```

#### chat-store

- `streamItems`: 当前流式消息的 MessageItem 列表
- `isLoading` / `isWaitingResponse`: 加载状态
- `pendingApprovalId`: 等待审批的工具 ID
- `onDone`: 流结束后将 streamItems 合并为助手消息

## StreamChunk 类型

```typescript
type ChunkType =
  | 'text'             // 文本内容
  | 'thinking'         // AI 思考过程
  | 'error'            // 错误信息
  | 'done'             // 流结束信号
  | 'tool_use'         // 工具调用（开始/完成）
  | 'tool_start'       // 工具开始执行
  | 'tool_input_delta' // 工具输入参数流式片段
  | 'tool_result'      // 工具执行结果
  | 'processing';      // 处理中

interface StreamChunk {
  type: ChunkType;
  content: string;
  toolUse?: ToolUseInfo;
  toolUseComplete?: boolean;
  toolInputDelta?: ToolInputDeltaInfo;
}
```

## 流式去重机制

SDK 的 `stream_event` 和后续的完整 `assistant` 消息可能包含相同的工具调用。`AgentService` 通过以下机制去重：

- `streamedToolIds: Set<string>` — 记录已通过流式事件发出的工具 ID
- `contentBlockToolMap: Map<number, { id, name }>` — 映射 content block index 到工具信息
- `handleAssistantMessage` 检查 `streamedToolIds` 避免重复发出 tool_use

每次 `handleAssistantMessage` 结束后调用 `resetStreamingState()` 清空状态。

## 取消流式响应

```typescript
// AgentService
abort(): void {
  if (this.activeQuery) {
    this.activeQuery.close();
    this.activeQuery = null;
  }
}

// 渲染层
await electronApiClient.abortStream();
```

## 核心代码

| 文件 | 职责 |
|------|------|
| `src/agent-service.ts` | SDK 消息映射、流式去重 |
| `src/main-process/ipc/chat-handlers.ts` | IPC 流转发 |
| `src/renderer/stores/chat-stream-listener.ts` | chunk 缓冲消费 |
| `src/renderer/stores/chat-stream-state.ts` | 纯 reducer 状态转换 |
| `src/renderer/stores/chat-store.ts` | 流式状态管理 |
