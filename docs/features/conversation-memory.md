# 对话记忆功能

> v1.2.0 新增功能

## 功能概述

对话记忆功能使 AI 能够记住之前的对话内容，实现真正的多轮对话体验。在此之前，每次发送消息都是独立的，AI 无法理解上下文。

## 实现原理

### 消息历史管理

在 `ClaudeService` 中维护一个消息历史数组：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

private messageHistory: ChatMessage[] = [];
```

### 消息流程

1. **用户发送消息**：消息被添加到 `messageHistory`
2. **发送给 AI**：将完整的 `messageHistory` 发送给 AI API
3. **收到响应**：AI 的回复也被添加到 `messageHistory`
4. **历史限制**：自动维护最多 50 条消息，避免超出上下文窗口

### 数据流

```
用户消息 → addToHistory('user', message)
    ↓
发送完整 messageHistory 给 AI
    ↓
收集 AI 流式响应
    ↓
addToHistory('assistant', response)
```

## 修改的文件

### 1. src/types/index.ts

新增类型定义：

```typescript
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
}
```

新增 IPC 通道：

```typescript
export const IPC_CHANNELS = {
  // ...existing channels
  CLEAR_HISTORY: 'clear-history',
  GET_HISTORY: 'get-history',
};
```

### 2. src/claude-service.ts

新增消息历史管理：

```typescript
private messageHistory: ChatMessage[] = [];

// 获取历史
getHistory(): ChatMessage[] {
  return [...this.messageHistory];
}

// 清除历史
clearHistory(): void {
  this.messageHistory = [];
}

// 添加到历史
private addToHistory(role: 'user' | 'assistant', content: string): void {
  this.messageHistory.push({ role, content, timestamp: Date.now() });
  
  // 限制历史长度
  if (this.messageHistory.length > MAX_HISTORY_LENGTH) {
    this.messageHistory = this.messageHistory.slice(-MAX_HISTORY_LENGTH);
  }
}
```

修改 API 调用，发送完整历史：

```typescript
// Anthropic 格式
const messages = this.messageHistory.map((msg) => ({
  role: msg.role,
  content: msg.content,
}));

// OpenAI 格式
const messages = [
  { role: 'system', content: systemPrompt },
  ...this.messageHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })),
];
```

### 3. src/main.ts

新增 IPC 处理器：

```typescript
ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
  claudeService.clearHistory();
});

ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
  return claudeService.getHistory();
});
```

### 4. src/preload.ts

暴露新 API：

```typescript
clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),
getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),
```

### 5. src/renderer.ts

新增清除功能：

```typescript
private async clearHistory(): Promise<void> {
  await window.electronAPI.clearHistory();
  this.chatContainer.innerHTML = '';
  this.addMessage('assistant', '对话已清除。有什么我可以帮你的吗？');
}
```

### 6. public/index.html

新增清除按钮：

```html
<button class="clear-btn" id="clearBtn" title="清除对话">清除</button>
```

## 使用方式

### 多轮对话

正常对话即可，AI 会自动记住上下文：

```
用户: 我叫张三
AI: 你好张三！很高兴认识你。

用户: 我叫什么名字？
AI: 你刚才告诉我你叫张三。
```

### 清除对话

点击输入框旁边的"清除"按钮，可以清空对话历史，开始新的对话。

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MAX_HISTORY_LENGTH | 50 | 最大保留消息数量 |

## 注意事项

1. **上下文窗口限制**：不同模型有不同的上下文窗口大小，过长的对话可能导致 API 错误
2. **内存使用**：消息历史存储在内存中，应用重启后会丢失
3. **取消响应**：如果用户取消了响应，该轮用户消息会从历史中移除

## 未来改进

- [ ] 会话持久化（保存到本地文件或数据库）
- [ ] 多会话管理
- [ ] 历史消息导出
- [ ] 自定义历史长度限制
