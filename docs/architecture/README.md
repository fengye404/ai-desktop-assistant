# 架构设计

本文档描述 AI Desktop Assistant 的当前系统架构（主进程 + 预加载桥 + React 渲染层）。

## 最新架构优化记录

- [Renderer 启动韧性重构（2026-02-21）](./renderer-startup-resilience-refactor-2026-02-21.md)
- [Renderer Bridge 失效兜底（2026-02-21）](./renderer-bridge-failsafe-guard-2026-02-21.md)
- [Claude Provider Adapter 接口化（2026-02-21）](./claude-provider-adapter-interface-refactor-2026-02-21.md)
- [Chat Stream Listener 运行时重构（2026-02-21）](./chat-stream-listener-runtime-refactor-2026-02-21.md)
- [Chat Stream State 回放测试（2026-02-21）](./chat-stream-state-replay-tests-2026-02-21.md)
- [Chat Store 流式状态重构（2026-02-21）](./chat-store-stream-reducer-refactor-2026-02-21.md)
- [Claude Service 服务层重构（2026-02-21）](./claude-service-service-layer-refactor-2026-02-21.md)
- [系统架构分析与优化（2026-02-21）](./system-architecture-analysis-and-optimization-2026-02-21.md)
- [前端与客户端系统架构重构记录（2026-02-21）](./frontend-client-architecture-refactor-2026-02-21.md)

## 进程模型

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  main.ts + main-process/*                                   │
│  - 应用生命周期管理                                         │
│  - 窗口创建与窗口状态管理                                   │
│  - IPC 分域注册（chat/session/config/security/tool）        │
│  - ClaudeService / SessionStorage 运行时上下文              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ IPC (typed channels)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                           │
│  preload.ts                                                 │
│  - contextBridge 暴露受限 API                               │
│  - 复用共享 IPC_CHANNELS / ElectronAPI 类型契约             │
│  - 单监听器替换策略（避免重复绑定）                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  src/renderer/* (React + Zustand)                           │
│  - UI 组件层                                                 │
│  - stores（状态与业务编排）                                 │
│  - services/electron-api-client（IPC 访问层）               │
└─────────────────────────────────────────────────────────────┘
```

## 分层职责

### 1. 主进程层（`src/main-process`）

- `main-process-context.ts`：管理运行时上下文（window、ClaudeService、SessionStorage）
- `tool-approval-coordinator.ts`：统一工具审批请求生命周期（请求、响应、超时）
- `window-factory.ts`：统一 BrowserWindow 创建与开发/生产加载策略
- `ipc/register-ipc-handlers.ts`：分域注册 IPC，避免 `main.ts` 单文件过载

### 2. 预加载桥（`src/preload.ts`）

- 单点暴露 `electronAPI`
- 复用 `src/types/index.ts` 的共享契约，避免重复定义 channel/type
- 对流式与审批事件采用“替换监听器”策略防止重复监听

### 3. 渲染层（`src/renderer`）

- `components/*`：纯视图组件
- `stores/*`：状态与流程编排（会话、配置、聊天流）
- `services/electron-api-client.ts`：统一封装 IPC 调用，降低 store 对 `window` 全局耦合

## 关键数据流（流式聊天）

```
ChatArea -> chat-store.sendMessage
   -> electron-api-client.sendMessageStream
   -> preload electronAPI
   -> main IPC: SEND_MESSAGE_STREAM
   -> ClaudeService.sendMessageStream
   -> main send STREAM_CHUNK
   -> preload onStreamChunk
   -> chat-store chunk reducer
   -> UI 渲染 + Session 持久化
```

## 架构约束

1. IPC 通道名仅维护在 `src/types/index.ts`
2. Renderer store 不直接访问 `window.electronAPI`，统一经 service 层调用
3. 主进程入口 `main.ts` 仅做编排，不承载具体领域逻辑
