# 对话记忆功能

> v1.2.0 新增功能，v1.3.0 升级为 SQLite 持久化存储

## 功能概述

对话记忆功能使 AI 能够记住之前的对话内容，实现真正的多轮对话体验。v1.3.0 版本升级为 SQLite 数据库存储，支持会话持久化和历史会话管理。

## 实现原理

### 消息历史管理

消息历史现在由 `SessionStorage` 服务管理，使用 SQLite 数据库持久化存储：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
```

### 存储架构

```
SessionStorage (SQLite)
├── sessions 表
│   ├── id (主键)
│   ├── title
│   ├── created_at
│   └── updated_at
└── messages 表
    ├── id (自增主键)
    ├── session_id (外键)
    ├── role
    ├── content
    └── timestamp
```

### 消息流程

1. **用户发送消息**：消息被添加到当前会话
2. **发送给 AI**：将当前会话的完整消息历史发送给 AI API
3. **收到响应**：AI 的回复被添加到当前会话
4. **自动保存**：所有变更自动持久化到 SQLite 数据库
5. **历史限制**：自动维护最多 50 条消息，避免超出上下文窗口

### 数据流

```
用户消息 → SessionStorage.updateMessages()
    ↓
发送完整会话历史给 AI
    ↓
收集 AI 流式响应
    ↓
SessionStorage.updateMessages() → SQLite 持久化
```

## 修改的文件

### 1. src/session-storage.ts (新增)

SQLite 会话存储服务：

```typescript
import Database from 'better-sqlite3';

export class SessionStorage {
  private db: Database.Database;
  private currentSessionId: string | null = null;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'sessions.db');
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  // 初始化数据库表
  private initDatabase(): void { ... }
  
  // 会话管理
  listSessions(): SessionMeta[] { ... }
  createSession(title?: string): Session { ... }
  switchSession(id: string): Session | null { ... }
  deleteSession(id: string): boolean { ... }
  renameSession(id: string, title: string): boolean { ... }
  
  // 消息管理
  getMessages(): ChatMessage[] { ... }
  updateMessages(messages: ChatMessage[]): void { ... }
  clearMessages(): void { ... }
}
```

### 2. src/types/index.ts

新增会话相关类型：

```typescript
export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

export const IPC_CHANNELS = {
  // ...existing channels
  SESSION_LIST: 'session-list',
  SESSION_GET: 'session-get',
  SESSION_CREATE: 'session-create',
  SESSION_DELETE: 'session-delete',
  SESSION_SWITCH: 'session-switch',
  SESSION_RENAME: 'session-rename',
};
```

### 3. src/claude-service.ts

改为使用 SessionStorage：

```typescript
export class ClaudeService {
  private sessionStorage: SessionStorage;

  constructor(sessionStorage: SessionStorage) {
    this.sessionStorage = sessionStorage;
  }

  private get messageHistory(): ChatMessage[] {
    return this.sessionStorage.getMessages();
  }

  private addToHistory(role: 'user' | 'assistant', content: string): void {
    const messages = this.sessionStorage.getMessages();
    messages.push({ role, content, timestamp: Date.now() });
    // 限制历史长度
    const trimmed = messages.slice(-MAX_HISTORY_LENGTH);
    this.sessionStorage.updateMessages(trimmed);
  }
}
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MAX_HISTORY_LENGTH | 50 | 单会话最大保留消息数量 |
| 数据库位置 | userData/sessions.db | SQLite 数据库文件路径 |

## 注意事项

1. **数据持久化**：所有对话现在会自动保存，重启应用后仍可访问
2. **上下文窗口限制**：不同模型有不同的上下文窗口大小
3. **取消响应**：如果用户取消了响应，该轮用户消息会从历史中移除
4. **数据库位置**：数据库存储在用户数据目录，打包后独立于应用

## 相关功能

- [历史会话记录](./session-history.md) - 侧边栏会话管理功能
