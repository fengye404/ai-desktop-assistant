# Renderer Bridge 失效兜底（2026-02-21）

## 问题现象

启动后出现主页黑屏。该类问题通常由渲染层在初始化阶段访问 `window.electronAPI` 失败引起，导致未捕获异常中断渲染流程。

## 本次修复

## 一、electron-api-client 增加 bridge 缺失兜底

改造文件：

- `src/renderer/services/electron-api-client.ts`

核心变化：

1. 引入 `getApiOrNull` 检查 `window.electronAPI`
2. 缺失时仅打印一次错误日志
3. 各 API 方法提供安全 fallback（no-op 或默认返回）
4. 避免同步抛错直接打断页面初始化

## 二、ChatArea 初始化监听器增加安全捕获

改造文件：

- `src/renderer/components/ChatArea.tsx`

核心变化：

1. `initStreamListener` 包裹 `try/catch`
2. 初始化失败时记录错误而不是让页面渲染链中断

## 结果

渲染层对 preload bridge 失效具备容错能力，不再因为单点初始化异常直接黑屏。

## 验证

```bash
npx eslint src/renderer/services/electron-api-client.ts src/renderer/components/ChatArea.tsx --ext .ts,.tsx
npx tsc --noEmit -p src/renderer/tsconfig.json
npm run -s build:main
npm run -s build:renderer
```

结果：通过。
