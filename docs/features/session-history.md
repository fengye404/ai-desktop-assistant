# 会话管理

> Agent SDK 迁移后的架构 — SDK 管理消息，SQLite 存储元数据

## 功能概述

会话管理采用混合存储架构：Claude Agent SDK 负责消息的持久化存储，应用的 SQLite 数据库（`SessionStorage`）仅存储会话元数据（自定义标题、删除标记）和应用配置。

## 界面设计

### 侧边栏布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │  侧边栏   │  │            主内容区                     │ │
│  │ (可拖拽)  │  │                                        │ │
│  │ [+新对话] │  │   ┌────────────────────────────────┐   │ │
│  │          │  │   │        对话消息                │   │ │
│  │ 会话1 ●  │  │   │   ToolCallBlock + Markdown     │   │ │
│  │ 会话2    │  │   └────────────────────────────────┘   │ │
│  │ 会话3    │  │                                        │ │
│  │ ...      │  │   ┌────────────────────────────────┐   │ │
│  │          │  │   │     Composer 输入区域          │   │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 会话项显示

- **标题**：自定义标题 > SDK 摘要 > 首条消息截取 > "新对话"
- **预览**：首条用户消息摘要
- **时间**：相对时间
- **操作**：重命名、删除

## 存储架构

### 混合存储模型

```
Claude Agent SDK
├── 消息内容持久化（SDK 内部管理）
├── 会话 ID 分配
└── 会话列表查询（listSessions）

SessionStorage (SQLite)
├── session_metadata 表
│   ├── sdk_session_id (主键，关联 SDK 会话)
│   ├── custom_title (用户自定义标题)
│   ├── deleted (软删除标记)
│   ├── created_at
│   └── updated_at
├── model_providers 表（提供商配置）
├── provider_models 表（模型列表）
├── config 表（活跃选择等键值配置）
└── model_instances 表（旧版遗留，仅迁移用）
```

### 会话注册

SDK 在首次 `query()` 时通过 `init` 系统消息分配 `session_id`。`AgentService` 通过 `onSessionInit` 回调通知 `SessionStorage` 注册该会话：

```
用户发送第一条消息
    → AgentService.sendMessageStream()
    → SDK query() → init 系统消息 { session_id: "..." }
    → AgentService.handleSystemMessage()
    → onSessionInitCallback(session_id)
    → SessionStorage.registerSession(session_id)
```

### 会话过滤

`session-list` 列表只显示本应用创建的会话，过滤逻辑：

```typescript
sdkSessions
  .filter(s => storage.isKnownSession(s.sessionId))    // 排除非本应用会话
  .filter(s => !storage.isSessionDeleted(s.sessionId))  // 排除已删除会话
```

## 操作流程

### 创建会话

1. 用户点击"+ 新对话"
2. `session-handlers` 中止当前查询，重置 `currentSessionId`
3. 返回临时会话 `{ id: 'new_${timestamp}', ... }`
4. 用户发送消息 → SDK 分配真实 session_id → 自动注册

### 切换会话

1. 用户点击侧边栏会话
2. `session-handlers` 中止当前查询
3. 查找 SDK 会话，设置 `currentSessionId`
4. 通过 `getSessionMessages()` 加载消息
5. `convertSdkSessionMessages()` 将 SDK 消息格式转换为应用格式

### 删除会话

软删除：`SessionStorage.markSessionDeleted(id)` 设置 `deleted = 1`，会话从列表中隐藏，但 SDK 中的数据保留。

### 重命名会话

`SessionStorage.setSessionTitle(id, title)` 更新 `custom_title` 字段。

## 核心代码

| 文件 | 职责 |
|------|------|
| `src/session-storage.ts` | SQLite 存储：会话元数据、提供商配置 |
| `src/agent-service.ts` | SDK 交互：listSessions、getSessionMessages |
| `src/main-process/ipc/session-handlers.ts` | 会话管理 IPC 处理器 |
| `src/renderer/stores/session-store.ts` | 会话列表状态管理 |
| `src/renderer/components/Sidebar.tsx` | 会话侧边栏 UI |

## 数据位置

SQLite 数据库位于用户数据目录：
- **macOS**: `~/Library/Application Support/ai-desktop-assistant/sessions.db`
- **Windows**: `%APPDATA%/ai-desktop-assistant/sessions.db`
- **Linux**: `~/.config/ai-desktop-assistant/sessions.db`

SDK 会话数据存储在工作目录中（由 SDK 管理）。
