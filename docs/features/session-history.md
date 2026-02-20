# 历史会话记录

> v1.3.0 新增功能

## 功能概述

历史会话记录功能提供侧边栏会话管理界面，支持多会话切换、会话持久化存储。用户可以随时切换回之前的对话，所有对话记录都会保存在本地 SQLite 数据库中。

## 界面设计

### 侧边栏布局

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │  侧边栏   │  │          主内容区               │  │
│  │          │  │                                 │  │
│  │ [+新对话] │  │   ┌───────────────────────┐   │  │
│  │          │  │   │      对话消息         │   │  │
│  │ 会话1    │  │   │                       │   │  │
│  │ 会话2    │  │   │                       │   │  │
│  │ 会话3    │  │   └───────────────────────┘   │  │
│  │ ...      │  │                                 │  │
│  │          │  │   ┌───────────────────────┐   │  │
│  │          │  │   │      输入区域         │   │  │
│  └──────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 会话项展示

每个会话项显示：
- **标题**：自动从首条用户消息生成（最多 30 字符）
- **预览**：最后一条 AI 回复的摘要（最多 50 字符）
- **时间**：相对时间（刚刚、X分钟前、X小时前、X天前）
- **操作**：重命名、删除按钮

## 技术实现

### 存储方案：SQLite (better-sqlite3)

选择 SQLite 作为存储方案的原因：
- **嵌入式**：无需额外安装数据库服务
- **可打包**：可直接打包到 Electron 应用中
- **高性能**：比 JSON 文件更高效的查询和存储
- **事务支持**：数据完整性有保障

### 数据库 Schema

```sql
-- 会话表
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 消息表
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_messages_session_id ON messages(session_id);
```

### 核心服务：SessionStorage

```typescript
export class SessionStorage {
  private db: Database.Database;
  private currentSessionId: string | null = null;

  // 会话列表
  listSessions(): SessionMeta[]
  
  // 获取会话
  getSession(id: string): Session | null
  
  // 创建会话
  createSession(title?: string): Session
  
  // 切换会话
  switchSession(id: string): Session | null
  
  // 删除会话
  deleteSession(id: string): boolean
  
  // 重命名会话
  renameSession(id: string, title: string): boolean
  
  // 更新消息
  updateMessages(messages: ChatMessage[]): void
}
```

## 修改的文件

### 1. src/session-storage.ts (新增)

完整的 SQLite 会话存储服务实现。

### 2. src/types/index.ts

新增类型和 IPC 通道：

```typescript
export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

export const IPC_CHANNELS = {
  SESSION_LIST: 'session-list',
  SESSION_GET: 'session-get',
  SESSION_CREATE: 'session-create',
  SESSION_DELETE: 'session-delete',
  SESSION_SWITCH: 'session-switch',
  SESSION_RENAME: 'session-rename',
};
```

### 3. src/main.ts

新增会话管理 IPC 处理器：

```typescript
ipcMain.handle(IPC_CHANNELS.SESSION_LIST, () => sessionStorage.listSessions());
ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, (_, title) => sessionStorage.createSession(title));
ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, (_, id) => sessionStorage.switchSession(id));
ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, (_, id) => sessionStorage.deleteSession(id));
ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, (_, id, title) => sessionStorage.renameSession(id, title));
```

### 4. src/preload.ts

暴露会话管理 API：

```typescript
sessionList: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),
sessionCreate: (title?: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, title),
sessionSwitch: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SWITCH, id),
sessionDelete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),
sessionRename: (id: string, title: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_RENAME, id, title),
```

### 5. src/renderer.ts

新增会话管理 UI 逻辑：

```typescript
// 加载会话列表
private async loadSessionList(): Promise<void>

// 渲染会话列表
private renderSessionList(sessions: SessionMeta[]): void

// 创建新会话
private async createNewSession(): Promise<void>

// 切换会话
private async switchSession(sessionId: string): Promise<void>

// 删除会话
private async deleteSession(sessionId: string): Promise<void>

// 重命名会话
private async renameSession(sessionId: string): Promise<void>
```

### 6. public/index.html

新增侧边栏 UI：

```html
<aside class="sidebar">
  <div class="sidebar-header">
    <button class="new-chat-btn" id="newChatBtn">
      <span>+</span> 新对话
    </button>
  </div>
  <div class="session-list" id="sessionList">
    <div class="no-sessions">暂无对话记录</div>
  </div>
</aside>
```

### 7. electron-builder.yml

配置原生模块打包：

```yaml
files:
  - node_modules/better-sqlite3/**/*

npmRebuild: true
buildDependenciesFromSource: true

asar: true
asarUnpack:
  - node_modules/better-sqlite3/**/*
```

## 使用方式

### 创建新对话

点击侧边栏顶部的"+ 新对话"按钮。

### 切换对话

点击侧边栏中的任意会话项即可切换。

### 重命名对话

点击会话项的"重命名"按钮，输入新标题。

### 删除对话

点击会话项的"删除"按钮，确认后删除。

## 依赖

| 包名 | 版本 | 说明 |
|------|------|------|
| better-sqlite3 | ^11.x | 高性能 SQLite 绑定 |
| @types/better-sqlite3 | ^7.x | TypeScript 类型 |
| @electron/rebuild | ^3.x | 原生模块重建工具 |

## 数据位置

数据库文件位于用户数据目录：
- **macOS**: `~/Library/Application Support/ai-desktop-assistant/sessions.db`
- **Windows**: `%APPDATA%/ai-desktop-assistant/sessions.db`
- **Linux**: `~/.config/ai-desktop-assistant/sessions.db`

## 相关功能

- [对话记忆](./conversation-memory.md) - 多轮对话支持
