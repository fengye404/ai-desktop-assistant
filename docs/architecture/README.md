# 架构设计

本目录包含 AI Desktop Assistant 的系统架构文档和架构演进记录。

## 当前架构

- **[系统架构文档](./system-architecture.md)** — 完整的系统架构参考（进程模型、服务详解、数据流、安全设计）

## 架构演进

### Agent SDK 迁移 (2026-02-26)

- [Agent SDK 迁移概述](./agent-sdk-migration-overview-2026-02-26.md) — AgentService 替换 ClaudeService，SDK 驱动工具和会话
- [协议翻译层设计](./protocol-translator-design-2026-02-26.md) — Anthropic ↔ OpenAI HTTP 代理设计

### 前端与渲染层 (2026-02-21)

- [前端与客户端系统架构重构](./frontend-client-architecture-refactor-2026-02-21.md) — 主进程分层、IPC 契约统一、store-service 解耦
- [Renderer 启动韧性重构](./renderer-startup-resilience-refactor-2026-02-21.md) — 错误边界、健康探针、加载失败诊断
- [Renderer Bridge 失效兜底](./renderer-bridge-failsafe-guard-2026-02-21.md) — electronAPI 缺失时安全降级

### 流式处理 (2026-02-21)

- [Chat Store 流式状态重构](./chat-store-stream-reducer-refactor-2026-02-21.md) — 纯 reducer 模块提炼
- [Chat Stream Listener 重构](./chat-stream-listener-runtime-refactor-2026-02-21.md) — 缓冲/队列流程抽离
- [Chat Stream State 回放测试](./chat-stream-state-replay-tests-2026-02-21.md) — Node 内置测试 + 回放验证

### 历史文档 (Agent SDK 迁移前，仅供参考)

> 以下文档描述的是 Agent SDK 迁移前的架构，部分内容已不再适用。

- [系统架构分析与优化](./system-architecture-analysis-and-optimization-2026-02-21.md) — IPC 分域、安全处理提纯
- [Claude Service 服务层重构](./claude-service-service-layer-refactor-2026-02-21.md) — 已被 AgentService 替代
- [Claude Provider Adapter 接口化](./claude-provider-adapter-interface-refactor-2026-02-21.md) — 已被 Agent SDK 替代

## 进程模型

```
┌──────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  main.ts → MainProcessContext                                    │
│  - AgentService（Claude Agent SDK 封装）                         │
│  - SessionStorage（SQLite 配置与会话元数据）                     │
│  - ToolApprovalCoordinator（工具审批桥接）                       │
│  - IPC 分域注册（chat/session/config/security/mcp/tool）         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (typed channels)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Preload Script                             │
│  preload.ts                                                      │
│  - contextBridge 暴露受限 API                                    │
│  - 内联 IPC_CHANNELS（沙箱限制）                                │
│  - 单监听器替换策略（避免重复绑定）                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Renderer Process                            │
│  src/renderer/* (React + Zustand)                                │
│  - UI 组件层                                                     │
│  - stores（状态与业务编排）                                     │
│  - services/electron-api-client（IPC 安全封装）                  │
│  - stream pipeline: listener → pure reducer → UI                 │
└──────────────────────────────────────────────────────────────────┘
```

## 关键数据流（流式聊天）

```
ChatArea → chat-store.sendMessage
   → electron-api-client.sendMessageStream
   → preload electronAPI
   → main IPC: SEND_MESSAGE_STREAM
   → AgentService.sendMessageStream → Claude Agent SDK query()
   → SDK Messages → mapSdkMessageToChunks → StreamChunk
   → main send STREAM_CHUNK
   → preload onStreamChunk
   → chat-stream-listener → chat-stream-state (pure reducer)
   → chat-store 更新 → UI 渲染
```

## 架构约束

1. IPC 通道名定义在 `src/types/index.ts`，preload 因沙箱限制内联一份（通过 ElectronAPI 接口保证一致性）
2. Renderer store 不直接访问 `window.electronAPI`，统一经 `electron-api-client` 调用
3. 主进程入口 `main.ts` 仅做编排，不承载具体领域逻辑
4. 消息持久化由 Agent SDK 管理，SQLite 仅存储配置和会话元数据
