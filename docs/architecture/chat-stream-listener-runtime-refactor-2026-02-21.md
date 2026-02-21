# Chat Stream Listener 运行时重构（2026-02-21）

## 背景

在完成 `chat-stream-state` reducer 化后，`chat-store` 里仍然保留了较重的运行时逻辑：

1. 文本/工具输入缓冲与定时 flush
2. 工具审批队列消费
3. chunk 分发控制流

这部分仍是 store 的主要复杂度来源。

## 本次改造

## 一、提炼 listener runtime 模块

新增：

- `src/renderer/stores/chat-stream-listener.ts`

核心职责：

1. `handleChunk`：统一处理 chunk 分发
2. `handleToolApprovalRequest`：统一处理审批请求与队列逻辑
3. `flushPendingBuffers`：文本/工具输入缓冲刷写
4. `dispose`：清理定时器与运行时缓存

该模块通过依赖注入回调与 store 解耦：

1. `getState` / `updateState`
2. `onDone` / `onError`
3. `isToolAllowed` / `respondToolApproval`

## 二、chat-store 继续收敛

`src/renderer/stores/chat-store.ts` 改造后：

1. 不再直接管理缓冲计时器与审批队列细节
2. 仅负责业务编排（会话持久化、错误写回、IPC 监听绑定）
3. 状态初始化与重置路径统一

## 收益

1. **优雅性**：store 角色更清晰，runtime 逻辑独立可维护。
2. **可维护性**：后续调整 flush 策略或审批队列行为时，改动局部化。
3. **可测试性**：listener runtime 可独立注入依赖并执行回放测试。

## 验证

```bash
npm run test:chat-stream
npx eslint src/renderer/stores/chat-store.ts src/renderer/stores/chat-stream-listener.ts --ext .ts
npx tsc --noEmit -p src/renderer/tsconfig.json
```

结果：通过。
