# AI Desktop Assistant

简体中文 | [English](./README.md)

![版本](https://img.shields.io/badge/version-1.2.0-4c1)
![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![许可证](https://img.shields.io/badge/license-MIT-22c55e)
![平台](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-6b7280)
![GitHub Stars](https://img.shields.io/github/stars/fengye404/ai-desktop-assistant?style=flat-square)
![GitHub Forks](https://img.shields.io/github/forks/fengye404/ai-desktop-assistant?style=flat-square)
![GitHub Issues](https://img.shields.io/github/issues/fengye404/ai-desktop-assistant?style=flat-square)
![GitHub Release](https://img.shields.io/github/v/release/fengye404/ai-desktop-assistant?style=flat-square)
![最后提交](https://img.shields.io/github/last-commit/fengye404/ai-desktop-assistant?style=flat-square)

基于 Electron + React + TypeScript 构建的桌面 AI 助手。

## 核心特性

- 支持多提供商模型接入（Anthropic 与 OpenAI 兼容接口）
- 流式响应渲染与工具调用可视化
- 本地会话存储与 API Key 安全持久化
- 基于 Electron IPC 的桌面端原生工作流

## 技术栈

- Electron 28
- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Zustand
- better-sqlite3

## 快速开始

```bash
npm install
npm start
```

## 配置说明

在 **Settings** 中配置：

- 提供商：Anthropic 或 OpenAI 兼容 API
- 模型：如 `claude-opus-4-6`、`gpt-4o`、`deepseek-chat`
- API Key：通过 Electron `safeStorage` 加密保存
- Base URL：兼容接口可自定义

## 常用命令

```bash
npm run build         # 构建主进程 + 渲染进程
npm run dev           # 开发模式
npm run lint          # 代码检查
npm run test:chat-stream
npm run dist          # 打包应用
```

## 文档

- [文档首页](./docs/README.md)
- [架构文档](./docs/architecture/README.md)
- [使用指南](./docs/guides/README.md)

## License

MIT
