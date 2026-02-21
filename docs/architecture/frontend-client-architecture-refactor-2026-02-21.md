# 前端与客户端系统架构重构记录（2026-02-21）

## 目标

围绕“可维护性、边界清晰、后续扩展成本”对当前系统做结构级优化，覆盖：

1. 客户端主进程架构
2. 前端状态与 IPC 调用架构
3. 共享类型契约一致性

## 重构前主要问题

1. `src/main.ts` 承载窗口管理、服务初始化、工具审批、所有 IPC 注册，文件职责过重。
2. 工具审批状态依赖主进程全局变量，生命周期管理分散。
3. `preload.ts` 内联 channel 常量和本地类型，容易和共享契约漂移。
4. 前端 store 直接依赖 `window.electronAPI`，状态层与基础设施层耦合。
5. 渲染层存在重复类型定义，跨层契约复用不足。

## 关键改造

## 一、主进程：单文件入口 -> 分层模块

### 新增模块

- `src/main-process/main-process-context.ts`
- `src/main-process/tool-approval-coordinator.ts`
- `src/main-process/window-factory.ts`
- `src/main-process/ipc/register-ipc-handlers.ts`

### 设计变化

1. `main.ts` 仅负责生命周期编排（启动、激活、退出）。
2. `MainProcessContext` 统一持有运行时对象：
   - `BrowserWindow`
   - `ClaudeService`
   - `SessionStorage`
3. `ToolApprovalCoordinator` 统一处理审批流程：
   - 请求发送
   - 响应回传
   - 超时兜底（默认拒绝）
4. IPC 处理按领域集中注册：
   - chat
   - session
   - config
   - security
   - tool approval

## 二、Preload：重复契约 -> 共享契约

### 变更文件

- `src/preload.ts`

### 设计变化

1. 直接复用 `src/types/index.ts` 中的：
   - `IPC_CHANNELS`
   - `ElectronAPI`
   - `StreamChunk`
   - `ToolApprovalRequest`
2. 去除 preload 内部重复 channel 常量与本地 API 类型定义。
3. 通过 `replaceListener` 统一监听器替换逻辑，防止同 channel 重复绑定。

## 三、前端：store 直连 window -> service 抽象层

### 新增模块

- `src/renderer/services/electron-api-client.ts`

### 变更文件

- `src/renderer/stores/chat-store.ts`
- `src/renderer/stores/session-store.ts`
- `src/renderer/stores/config-store.ts`
- `src/renderer/components/ToolApprovalDialog.tsx`
- `src/renderer/components/SettingsDialog.tsx`

### 设计变化

1. Renderer 侧新增 IPC 访问层 `electronApiClient`。
2. store 不再直接调用 `window.electronAPI`，统一走 service。
3. store 复用共享类型（`src/types/index.ts`），减少重复声明。
4. `ToolApprovalDialog` 改为基于当前 `chat-store` 状态派生，不再依赖已移除字段。

## 文件结构变化（核心）

```text
src/
├── main.ts
├── main-process/
│   ├── main-process-context.ts
│   ├── tool-approval-coordinator.ts
│   ├── window-factory.ts
│   └── ipc/
│       └── register-ipc-handlers.ts
├── preload.ts
└── renderer/
    ├── services/
    │   └── electron-api-client.ts
    └── stores/
        ├── chat-store.ts
        ├── session-store.ts
        └── config-store.ts
```

## 效果评估

1. 主进程入口复杂度显著下降，新增 IPC 领域时不再膨胀 `main.ts`。
2. 工具审批逻辑集中，行为更可预测（含超时策略）。
3. 前端状态层与 Electron 全局 API 解耦，便于后续测试与 mock。
4. 共享契约单点维护，降低通道名和类型漂移风险。

## 验证

已执行并通过：

```bash
npm run build
npx tsc --noEmit -p src/renderer/tsconfig.json
```

## 后续建议

1. 将 `src/main-process/ipc/register-ipc-handlers.ts` 进一步拆分为多文件（按 chat/session/config/security 细分）。
2. 为 `electron-api-client` 增加错误标准化与重试策略。
3. 为 chat 流式 reducer 增加单元测试（chunk 序列回放场景）。
