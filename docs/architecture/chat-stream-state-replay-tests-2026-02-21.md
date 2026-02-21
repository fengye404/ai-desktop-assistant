# Chat Stream State 回放测试（2026-02-21）

## 目标

为 `chat-stream-state` 提供可回放、可自动执行的单元测试，确保流式状态重构后行为稳定。

## 实施内容

1. 新增测试文件  
   `src/renderer/stores/__tests__/chat-stream-state.test.ts`
2. 新增测试文件  
   `src/renderer/stores/__tests__/chat-stream-listener.test.ts`
3. 新增测试编译配置  
   `tsconfig.renderer-tests.json`
4. 新增测试命令  
   `npm run test:chat-stream`

## 测试策略

采用 Node 内置 `node:test`，避免引入额外测试框架依赖；通过独立 `tsc` 配置将测试与目标模块编译到 `dist-tests/` 后执行。

覆盖场景：

1. 文本 chunk 合并
2. 工具输入增量创建/更新
3. 工具状态流转（pending/running/success）
4. 缺失 tool id 的 fallback 结果更新
5. 工具审批请求与拒绝路径
6. processing 状态与文本汇总
7. listener 缓冲 flush 与审批队列消费
8. listener done/error 回调路径

## 运行方式

```bash
npm run test:chat-stream
```

## 结果

当前用例 11 条，全部通过。
