# 流式响应

> v1.1.0 基础功能，v1.3.1 性能优化

## 功能概述

流式响应功能实现 AI 回复的实时显示，用户可以看到 AI 逐字生成内容，而不是等待完整响应。这提供了更好的用户体验和更快的感知响应时间。

## 实现原理

### 数据流架构

```
AI API (Anthropic/OpenAI)
    ↓ SSE 流式响应
ClaudeService (AsyncGenerator)
    ↓ yield chunk
Main Process (IPC)
    ↓ webContents.send()
Renderer Process
    ↓ 实时显示
UI 更新
```

### 核心实现

#### 1. AI 服务层 (claude-service.ts)

使用 AsyncGenerator 实现流式输出：

```typescript
async *sendMessageStream(message: string): AsyncGenerator<StreamChunk> {
  // Anthropic API
  const stream = client.messages.stream({ ... });
  
  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      yield { type: 'text', content: event.delta.text };
    }
  }
}
```

#### 2. 主进程 (main.ts)

通过 IPC 发送流式数据：

```typescript
ipcMain.handle('send-message-stream', async (_, message) => {
  const stream = claudeService.sendMessageStream(message);
  
  for await (const chunk of stream) {
    mainWindow.webContents.send('stream-chunk', chunk);
  }
  
  mainWindow.webContents.send('stream-chunk', { type: 'done' });
});
```

#### 3. 渲染进程 (renderer.ts)

v1.3.1 优化后的流式显示：

```typescript
private streamingContent = '';

private handleStreamChunk(chunk: StreamChunk): void {
  if (chunk.type === 'done') {
    // 完成时格式化完整内容
    this.currentAssistantMessage.innerHTML = this.formatContent(this.streamingContent);
    this.streamingContent = '';
    return;
  }

  if (chunk.type === 'text') {
    // 流式过程中使用 textContent 快速更新
    this.streamingContent += chunk.content;
    this.currentAssistantMessage.textContent = this.streamingContent;
  }
}
```

## v1.3.1 性能优化

### 问题

之前的实现在每个 chunk 到来时都调用 `formatContent()` 并设置 `innerHTML`，导致：
- 每次都重新解析 HTML，性能低下
- 不完整的 Markdown 语法被错误格式化
- 显示出现卡顿

### 解决方案

1. **流式过程**：使用 `textContent` 直接显示纯文本（更快）
2. **累积内容**：将所有 chunk 累积到 `streamingContent` 变量
3. **完成格式化**：只在流结束时（`done` 信号）调用 `formatContent()` 格式化完整内容

### 效果对比

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 每 chunk 操作 | innerHTML + formatContent | textContent |
| HTML 解析 | 每 chunk 一次 | 仅完成时一次 |
| Markdown 格式化 | 部分内容（可能出错） | 完整内容 |
| 用户感知 | 可能卡顿 | 流畅 |

## StreamChunk 类型

```typescript
type ChunkType = 'text' | 'thinking' | 'error' | 'done';

interface StreamChunk {
  type: ChunkType;
  content: string;
}
```

| 类型 | 说明 |
|------|------|
| `text` | 正常文本内容 |
| `thinking` | AI 思考过程（预留） |
| `error` | 错误信息 |
| `done` | 流结束信号 |

## 取消流式响应

用户可以随时取消正在进行的流式响应：

```typescript
// 服务端
abort(): void {
  if (this.abortController) {
    this.abortController.abort();
  }
}

// 客户端
await window.electronAPI.abortStream();
```

取消后，当前轮次的用户消息会从历史中移除，避免上下文污染。

## 相关功能

- [对话记忆](./conversation-memory.md) - 消息历史管理
- [历史会话](./session-history.md) - 会话持久化
