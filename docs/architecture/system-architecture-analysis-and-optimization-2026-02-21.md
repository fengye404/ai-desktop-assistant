# 系统架构分析与优化（2026-02-21）

## 目标

从软件系统架构师视角，对当前代码结构进行一次“低风险、可验证、可持续”的增量优化，重点提升：

1. 代码优雅性（职责单一、边界清晰）
2. 可维护性（扩展成本可控）
3. 易读性（降低新成员理解成本）

## 后续迭代

- 第二阶段（服务层拆分）见：
  [Claude Service 服务层重构（2026-02-21）](./claude-service-service-layer-refactor-2026-02-21.md)
- 第三阶段（前端流式状态 reducer 化）见：
  [Chat Store 流式状态重构（2026-02-21）](./chat-store-stream-reducer-refactor-2026-02-21.md)
- 第四阶段（流式状态回放测试）见：
  [Chat Stream State 回放测试（2026-02-21）](./chat-stream-state-replay-tests-2026-02-21.md)
- 第五阶段（listener runtime 解耦）见：
  [Chat Stream Listener 运行时重构（2026-02-21）](./chat-stream-listener-runtime-refactor-2026-02-21.md)
- 第六阶段（provider adapter 接口化）见：
  [Claude Provider Adapter 接口化（2026-02-21）](./claude-provider-adapter-interface-refactor-2026-02-21.md)
- 第七阶段（renderer bridge 失效兜底）见：
  [Renderer Bridge 失效兜底（2026-02-21）](./renderer-bridge-failsafe-guard-2026-02-21.md)
- 第八阶段（renderer 启动韧性重构）见：
  [Renderer 启动韧性重构（2026-02-21）](./renderer-startup-resilience-refactor-2026-02-21.md)

## 架构现状评估

## 已有优势

1. 进程边界明确：`main` / `preload` / `renderer` 三层结构清晰。
2. 类型契约基础较好：`src/types/index.ts` 作为共享模型中心。
3. 前端调用层已有抽象：`renderer/services/electron-api-client.ts` 解耦了 `window` 直连。

## 主要问题

1. `src/main-process/ipc/register-ipc-handlers.ts` 承担了全部领域逻辑，文件职责过载。
2. 安全相关逻辑（加解密、plain fallback）内嵌在注册文件中，可读性与复用性较弱。
3. IPC 领域扩展时（新增 channel）仍会持续膨胀单文件，容易引入回归。

## 本次优化范围

本次仅做“结构重排”，不改变 IPC 通道名、入参、返回值和业务行为。

## 具体改造

## 一、IPC 注册分域模块化（主改造）

将原先单文件 IPC 注册拆分为以下领域模块：

- `src/main-process/ipc/chat-handlers.ts`
- `src/main-process/ipc/session-handlers.ts`
- `src/main-process/ipc/config-handlers.ts`
- `src/main-process/ipc/security-handlers.ts`
- `src/main-process/ipc/tool-approval-handlers.ts`

并保留 `src/main-process/ipc/register-ipc-handlers.ts` 作为轻量编排入口：

- 只负责调用各领域 `register*Handlers`
- 不再承载具体业务细节

### 价值

1. 单文件复杂度下降，阅读路径更短。
2. 新增/修改某类通道时，影响范围局部化。
3. 主进程 IPC 层可以按领域独立测试和演进。

## 二、安全处理逻辑提纯

在 `src/main-process/ipc/security-handlers.ts` 中：

1. 抽离 `plain:` 前缀常量与编解码函数。
2. 抽离 `encryptString` / `decryptString` 纯函数。
3. 注册函数仅负责 `ipcMain.handle` 绑定，业务逻辑下沉到辅助函数。

### 价值

1. 错误路径更统一，日志更一致。
2. 审阅时可以快速定位“注册逻辑”和“安全逻辑”。
3. 后续若需要替换加密策略，改动集中。

## 质量验证

已执行：

```bash
npm run -s build:main
npm run -s build:renderer
```

结果：均通过，说明本次重构未引入编译层回归。

## 架构收益总结

1. **优雅性**：由“横向堆叠”改为“纵向分层”，入口文件保持轻薄。
2. **可维护性**：领域隔离后，变更冲突概率与回归面明显降低。
3. **易读性**：开发者可按业务域直接定位代码，而非在单文件中跳转查找。

## 后续建议（下一阶段）

1. 将 `src/claude-service.ts` 继续拆分为 provider 层与 stream 编排层。
2. 为 `src/renderer/stores/chat-store.ts` 提取 stream reducer 为独立纯函数模块。
3. 为 IPC handler 增加最小单测（mock `ipcMain` + context）。
4. 建立 `docs/architecture/adr/`，沉淀后续关键架构决策记录（ADR）。
