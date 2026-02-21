# 功能特性

本目录包含 AI Desktop Assistant 各功能模块的详细说明。

## 功能列表

| 功能 | 文档 | 说明 |
|------|------|------|
| 工具系统 | [tool-system.md](./tool-system.md) | Agentic Loop、内置工具、权限控制 |
| 对话记忆 | [conversation-memory.md](./conversation-memory.md) | 多轮对话上下文记忆 |
| 历史会话 | [session-history.md](./session-history.md) | 侧边栏会话管理 |
| 流式响应 | [streaming.md](./streaming.md) | 实时显示 AI 生成内容 |

## 核心功能概览

### 1. 工具系统 (v1.4.0 新增)

参考 Claude Agent SDK 设计的 Agentic Loop 架构：

- **9 个内置工具**：读写文件、编辑、搜索、命令执行、网页获取等
- **三级权限控制**：allow（自动）、ask（弹窗确认）、deny（禁止）
- **循环调用**：AI 可连续调用多个工具完成复杂任务（最多 10 次）

详见：[工具系统](./tool-system.md)

### 2. 对话记忆 (v1.2.0 新增)

支持多轮对话，AI 能够记住之前的对话内容：

- 消息历史自动管理
- 最多保存 50 条消息
- 支持清除对话历史
- 同时支持 Anthropic 和 OpenAI 格式

详见：[对话记忆功能](./conversation-memory.md)

### 3. 历史会话记录 (v1.3.0 新增)

侧边栏会话管理，支持多会话切换和持久化存储：

- 侧边栏显示历史会话列表
- SQLite 数据库持久化存储
- 支持创建、切换、删除、重命名会话
- 自动从首条消息生成会话标题
- 相对时间显示

详见：[历史会话记录](./session-history.md)

### 4. 双 API 格式支持

- **Claude API**：Anthropic 官方 API
- **OpenAI 兼容 API**：支持所有 OpenAI 兼容服务
  - OpenAI
  - Ollama (本地)
  - DeepSeek
  - Moonshot
  - 智谱 AI
  - 等等...

### 5. 流式响应 (v1.3.1 优化)

- 使用 AsyncGenerator 实现
- 实时显示生成内容
- 支持随时取消响应
- v1.3.1 优化：流式过程使用 textContent 快速更新，完成后再格式化

详见：[流式响应](./streaming.md)

### 6. 安全存储 (v1.3.1 改进)

- API Key 使用系统级加密存储
- v1.3.1：配置持久化到 SQLite，重启不丢失
- macOS: safeStorage (Keychain)
- Windows: safeStorage (DPAPI)
- Linux: safeStorage (Secret Service)

### 7. 现代 UI

- Glassmorphism 设计风格
- 响应式布局
- Markdown 渲染支持
- 侧边栏会话管理
