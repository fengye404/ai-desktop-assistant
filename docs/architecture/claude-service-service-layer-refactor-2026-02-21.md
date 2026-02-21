# Claude Service 服务层重构（2026-02-21）

## 背景

`src/claude-service.ts` 在一个文件内同时承担了以下职责：

1. Provider 流式调用细节（Anthropic / OpenAI）
2. 工具循环执行与事件转换
3. 会话历史编排与持久化
4. API client 初始化与配置切换

这会导致单文件复杂度过高，后续扩展 provider 或调整流式策略时改动面过大。

## 本次改造

## 一、提炼服务层常量模块

新增：

- `src/ai/claude-service-constants.ts`

收敛了以下内容：

1. 默认 token 与历史长度常量
2. 工具流式相关常量
3. 默认系统提示词
4. 工具结果截断函数 `truncateToolResultContent`

## 二、提炼 Provider 流式执行模块

新增：

- `src/ai/provider-streams.ts`

集中承载：

1. `streamAnthropicWithTools`：Anthropic 工具循环与流式事件转译
2. `streamOpenAICompatible`：OpenAI 兼容流式响应处理

并保留原行为：

1. Anthropic fine-grained tool streaming beta 自动降级
2. 工具执行事件 `tool_start` / `tool_result` / `processing` 输出
3. Abort 信号检查与 `StreamAbortedError` 语义保持一致

## 三、`ClaudeService` 退化为编排层

改造后 `src/claude-service.ts` 主要负责：

1. 配置与 client 生命周期管理
2. `sendMessageStream` 的历史与 UI item 编排
3. 调用 provider stream 模块并拼接统一输出

也就是说，`ClaudeService` 不再直接承载 provider 细节代码块。

## 收益

1. **优雅性**：类职责更聚焦，避免“上帝类”继续膨胀。
2. **可维护性**：provider 相关修改局部化到 `src/ai/provider-streams.ts`。
3. **易读性**：核心流程（历史、状态、编排）与底层流式细节分离。

## 兼容性说明

本次为内部结构重构，未修改以下外部契约：

1. `ClaudeService` 对外公开方法签名
2. `StreamChunk` 结构
3. 主进程 IPC 通道与渲染层调用方式

## 验证

已执行：

```bash
npm run -s build:main
npx eslint src/claude-service.ts src/ai --ext .ts
```

结果：通过。

Provider 分发接口化见：
`docs/architecture/claude-provider-adapter-interface-refactor-2026-02-21.md`
