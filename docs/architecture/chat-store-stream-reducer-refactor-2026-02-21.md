# Chat Store 流式状态重构（2026-02-21）

## 背景

`src/renderer/stores/chat-store.ts` 原实现中，流式 chunk 的状态处理与 IPC 监听、缓冲定时器、会话持久化混在同一文件，导致：

1. 单文件认知负担高
2. 状态更新逻辑重复、难复用
3. 后续补测试时难以隔离纯逻辑

## 本次改造

## 一、提炼纯状态模块

新增：

- `src/renderer/stores/chat-stream-state.ts`

将以下逻辑提炼为纯函数：

1. 文本 chunk 追加与合并
2. 工具输入增量（`tool_input_delta`）批量应用
3. 工具状态流转（`tool_use` / `tool_start` / `tool_result`）
4. 工具审批状态更新（approve/reject/request）
5. stream item 文本汇总

## 二、chat-store 收敛为编排层

`src/renderer/stores/chat-store.ts` 现在主要负责：

1. IPC 监听与回调绑定
2. 缓冲计时器调度（text/tool input flush）
3. 会话消息持久化与刷新
4. 调用纯 reducer 函数完成状态变更

## 架构收益

1. **优雅性**：状态变更职责集中在一个纯逻辑模块
2. **可维护性**：新增 chunk 类型时可在 reducer 模块局部扩展
3. **易读性**：store 代码更聚焦“流程编排”而不是“细节变换”

## 兼容性

未改变以下外部行为：

1. Zustand store 对外 API
2. IPC 通道与数据格式
3. 现有工具审批与流式展示语义

## 验证

已执行：

```bash
npx eslint src/renderer/stores/chat-store.ts src/renderer/stores/chat-stream-state.ts --ext .ts
npx tsc --noEmit -p src/renderer/tsconfig.json
```

结果：通过。

回放单测见：
`docs/architecture/chat-stream-state-replay-tests-2026-02-21.md`

listener runtime 进一步解耦见：
`docs/architecture/chat-stream-listener-runtime-refactor-2026-02-21.md`
