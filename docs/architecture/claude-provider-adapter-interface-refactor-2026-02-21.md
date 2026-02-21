# Claude Provider Adapter 接口化（2026-02-21）

## 背景

在服务层拆分后，`ClaudeService` 仍通过 `if (provider === 'anthropic') ... else ...` 决定 provider 行为。
这种分支写法在继续增加 provider 时会让 `ClaudeService` 再次膨胀。

## 本次改造

## 一、引入 provider adapter 抽象

新增：

- `src/ai/providers/provider-stream-adapter.ts`

定义统一契约：

1. `ProviderStreamContext`
2. `ProviderStreamAdapter`

## 二、实现两个具体 adapter

新增：

- `src/ai/providers/anthropic-stream-adapter.ts`
- `src/ai/providers/openai-stream-adapter.ts`
- `src/ai/providers/provider-adapter-registry.ts`

分别封装 Anthropic/OpenAI 的流式创建逻辑，复用已有 `provider-streams` 实现。

## 三、ClaudeService 改为注册表分发

改造：

- `src/claude-service.ts`

关键变化：

1. 构造函数通过 `provider-adapter-registry` 建立 `providerAdapters` 注册表
2. `streamProviderResponse` 从注册表获取 adapter 分发
3. 保持原有 public API 与行为不变

## 收益

1. **优雅性**：`ClaudeService` 从 provider 分支细节中解耦。
2. **可维护性**：新增 provider 只需新增 adapter 并注册。
3. **可读性**：provider 选择逻辑由条件分支改为统一分发模式。

## 验证

```bash
npm run -s build:main
npx eslint src/claude-service.ts src/ai/providers --ext .ts
npm run -s test:chat-stream
```

结果：通过。
