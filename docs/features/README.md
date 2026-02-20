# 功能特性

本目录包含 AI Desktop Assistant 各功能模块的详细说明。

## 功能列表

| 功能 | 文档 | 说明 |
|------|------|------|
| 对话记忆 | [conversation-memory.md](./conversation-memory.md) | 多轮对话上下文记忆 |
| 流式响应 | [streaming.md](./streaming.md) | 实时显示 AI 生成内容 |
| 多 API 支持 | [multi-provider.md](./multi-provider.md) | 支持多种 AI 服务商 |

## 核心功能概览

### 1. 对话记忆 (v1.2.0 新增)

支持多轮对话，AI 能够记住之前的对话内容：

- 消息历史自动管理
- 最多保存 50 条消息
- 支持清除对话历史
- 同时支持 Anthropic 和 OpenAI 格式

详见：[对话记忆功能](./conversation-memory.md)

### 2. 双 API 格式支持

- **Claude API**：Anthropic 官方 API
- **OpenAI 兼容 API**：支持所有 OpenAI 兼容服务
  - OpenAI
  - Ollama (本地)
  - DeepSeek
  - Moonshot
  - 智谱 AI
  - 等等...

### 3. 流式响应

- 使用 AsyncGenerator 实现
- 实时显示生成内容
- 支持随时取消响应

### 4. 安全存储

- API Key 使用系统级加密存储
- macOS: Keychain
- Windows: DPAPI
- Linux: Secret Service

### 5. 现代 UI

- Glassmorphism 设计风格
- 响应式布局
- Markdown 渲染支持
