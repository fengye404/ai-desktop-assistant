# 启动黑屏排查指南（2026-02-21）

## 适用场景

`npm start` 启动后，窗口显示黑色空白，主界面未正常渲染。

## 新版行为（已内置）

当前版本已加入三层兜底：

1. 渲染异常会进入应用内错误页（不再直接黑屏）
2. 页面加载失败会跳转主进程诊断页（显示错误码和 URL）
3. 页面加载后未挂载 React 根节点会自动显示“Renderer 未完成挂载”诊断页
4. `window.electronAPI` 采用延迟探测（约 3.6 秒）后才提示 bridge 缺失，避免启动瞬时误报

如果你仍看到纯黑页面，优先检查 Electron 运行环境和日志采集权限。

## 快速排查步骤

1. 重新编译并启动：

```bash
npm run build
npm start
```

2. 检查基础编译是否通过：

```bash
npm run -s build:main
npm run -s build:renderer
npx tsc --noEmit -p src/renderer/tsconfig.json
```

3. 查看控制台日志关键前缀：

- `[renderer]`（渲染层启动、未处理异常）
- `[main-window]`（加载失败、健康检查、渲染进程退出）

## 常见根因

1. preload bridge 未注入（`window.electronAPI` 不可用）
2. 渲染入口异常（组件渲染抛错）
3. 构建产物路径不匹配（`dist/renderer/index.html` 或 `dist/preload.js`）
4. 环境级限制导致 Electron 无法稳定加载渲染进程

## 回归验证命令

```bash
npx eslint src/main-process/window-factory.ts src/renderer/main.tsx src/renderer/App.tsx src/renderer/components/AppErrorBoundary.tsx src/renderer/services/electron-api-client.ts
npm run -s test:chat-stream
```
