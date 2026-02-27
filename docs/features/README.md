# 功能特性

本目录包含 AI Desktop Assistant 各功能模块的详细说明。

## 功能列表

| 功能 | 文档 | 说明 |
|------|------|------|
| 工具系统 | [tool-system.md](./tool-system.md) | Agent SDK 工具执行、权限审批、UI 展示 |
| 会话管理 | [session-history.md](./session-history.md) | 侧边栏会话管理、SDK + SQLite 混合存储 |
| 流式响应 | [streaming.md](./streaming.md) | 实时显示 AI 生成内容 |

## 核心功能概览

### 1. Agent SDK 工具系统

工具由 Claude Agent SDK 提供和管理（`claude_code` 预设工具集），支持文件读写、搜索、命令执行等。

- **SDK 内置工具集**：由 `tools: { type: 'preset', preset: 'claude_code' }` 启用
- **权限审批**：通过 `canUseTool` 回调 → `ToolApprovalCoordinator` → 渲染层 ToolCallBlock 内联确认
- **MCP 动态扩展**：支持 Stdio/SSE/HTTP 三种传输方式

详见：[工具系统](./tool-system.md)

### 2. 会话管理

SDK 管理消息持久化，SQLite 存储应用级元数据：

- 侧边栏显示历史会话列表
- SDK 负责消息存储，SQLite 只存自定义标题和删除标记
- 支持创建、切换、删除、重命名会话
- 会话过滤：仅显示本应用创建的会话（`isKnownSession`）

详见：[会话管理](./session-history.md)

### 3. 双提供商支持

- **Anthropic**：Agent SDK 直连
- **OpenAI 兼容**：通过本地协议翻译代理（Anthropic ↔ OpenAI 格式转换）
  - OpenAI、Ollama (本地)、DeepSeek、Moonshot、智谱 AI 等

### 4. 流式响应

- Agent SDK `query()` 返回 AsyncIterable 流
- SDK Messages 映射为 `StreamChunk` 发送到渲染层
- 渲染层通过纯 reducer 管线处理：`chat-stream-listener` → `chat-stream-state`
- 支持文本、工具调用、思考过程等多种 chunk 类型

详见：[流式响应](./streaming.md)

### 5. 安全存储

- API Key 使用 Electron `safeStorage` 系统级加密
- macOS: Keychain, Windows: DPAPI, Linux: Secret Service
- 降级方案：`plain:` 前缀明文存储

### 6. 现代 UI

- Glassmorphism 设计风格
- 可拖拽调整宽度的侧边栏
- Markdown 渲染 + 代码语法高亮
- 工具调用可折叠卡片 + 内联审批
- 斜杠命令 (`/help`, `/clear`, `/model` 等)
- @ 路径引用和自动补全
- 图片附件（粘贴/拖拽）
