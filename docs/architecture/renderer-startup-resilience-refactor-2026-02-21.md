# Renderer 启动韧性重构（2026-02-21）

## 背景

在连续架构重构后，出现了 `npm start` 启动后首页黑屏的问题。该类问题通常来自两个方向：

1. 渲染层运行时异常导致 React 树未挂载
2. 页面资源或脚本加载异常，但窗口仍显示为黑色空白

本次改造目标是“即使出错也不黑屏”，并让故障可定位。

## 改造内容

## 一、Renderer 侧加入启动与渲染兜底

改造文件：

- `src/renderer/main.tsx`
- `src/renderer/components/AppErrorBoundary.tsx`

核心变化：

1. 新增 `AppErrorBoundary`，捕获未处理渲染异常并显示可恢复提示页（含重载按钮）。
2. 在 `main.tsx` 安装全局 `error` / `unhandledrejection` 日志钩子，避免异常静默。
3. 增加 `#root` 缺失时的静态 fatal fallback，防止入口节点缺失导致纯空白。
4. 渲染成功后写入 `document.body.dataset.rendererReady = 'true'` 作为主进程健康探针信号。

## 二、App 启动链路可视化

改造文件：

- `src/renderer/App.tsx`
- `src/renderer/services/electron-api-client.ts`

核心变化：

1. `electronApiClient` 暴露 `isAvailable()`，统一判断 bridge 可用性。
2. App 启动时并行执行 `loadConfig/loadSessions`，并在异常时展示启动告警条。
3. 当 `window.electronAPI` 不可用时，顶部明确提示已进入“安全降级模式”。

## 三、Main Window 增加加载失败与挂载健康探针

改造文件：

- `src/main-process/window-factory.ts`

核心变化：

1. `did-fail-load` 时不再黑屏，自动切换到诊断页并显示错误码、错误描述和目标 URL。
2. `did-finish-load` 后执行渲染健康检查（是否已挂载 React 根节点）。
3. 健康检查失败时自动切换诊断页，明确提示“Renderer 未完成挂载”。
4. `render-process-gone` 日志化，便于定位进程级崩溃。

## 结果

这轮改造将“黑屏”从不可观测状态转为可恢复、可诊断状态：

1. 渲染异常不会直接导致纯黑空白。
2. 页面加载失败和挂载失败都有可见诊断页。
3. 主进程与渲染层的错误链路都有统一日志前缀，便于定位。

## 验证

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json
npx eslint src/main-process/window-factory.ts src/renderer/main.tsx src/renderer/App.tsx src/renderer/components/AppErrorBoundary.tsx src/renderer/services/electron-api-client.ts
npm run -s build:main
npm run -s build:renderer
npm run -s test:chat-stream
```

结果：全部通过。
