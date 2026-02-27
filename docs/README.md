# AI Desktop Assistant 文档中心

> 基于 Electron + Vite + React + Tailwind CSS 构建的跨平台 AI 对话桌面应用

## 产品定位

AI Desktop Assistant 定位为类似 **Anthropic Cowork** 的桌面 AI 协作工具，核心架构围绕 Claude Agent SDK 构建，提供流畅的多轮对话体验、本地文件集成和可扩展的工具系统。通过协议翻译层，同时支持 OpenAI 兼容的第三方模型提供商。

## 文档目录

### 核心文档

| 文档 | 说明 |
|------|------|
| [项目概述](./overview.md) | 项目简介、技术栈、整体架构 |
| [产品路线图](./roadmap.md) | 未来发展方向、功能规划 |

### 模块文档

| 模块 | 说明 |
|------|------|
| [系统架构](./architecture/system-architecture.md) | 完整系统架构（进程模型、数据流、服务详解） |
| [架构设计](./architecture/README.md) | 架构优化记录 |
| [功能特性](./features/README.md) | 各功能模块的详细说明 |
| [API 参考](./api/README.md) | IPC 通信接口、类型定义 |
| [使用指南](./guides/README.md) | 配置说明、常见问题 |

### 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.0.0 | 2026-02-28 | 架构清理：移除废弃代码、统一文档、修复架构不一致 |
| v1.7.0 | 2026-02-26 | Agent SDK 迁移：AgentService 替换 ClaudeService，协议翻译层 |
| v1.6.9 | 2026-02-21 | UI 视觉修复：移除顶部 bridge 警告横幅、优化会话列表与滚动条 |
| v1.6.8 | 2026-02-21 | 启动韧性重构：渲染错误边界、挂载健康探针、加载失败诊断页 |
| v1.6.7 | 2026-02-21 | 渲染层黑屏兜底：Electron bridge 缺失时安全降级 |
| v1.6.6 | 2026-02-21 | Claude Provider Adapter 接口化 |
| v1.6.5 | 2026-02-21 | Chat Stream Listener runtime 重构 |
| v1.6.4 | 2026-02-21 | Chat Stream State 回放单测 |
| v1.6.3 | 2026-02-21 | Chat Store 流式状态重构 |
| v1.6.2 | 2026-02-21 | Claude Service 服务层重构 |
| v1.6.1 | 2026-02-21 | 系统架构分析与优化 |
| v1.6.0 | 2026-02-21 | 前端与客户端架构重构 |
| v1.5.1 | 2026-02-21 | 页面展示与性能优化 |
| v1.5.0 | 2026-02-21 | 工具调用 UI 展示、权限设置、gzip 持久化 |
| v1.4.0 | 2026-02-21 | 工具系统：Agentic Loop、内置工具、权限控制 |
| v1.3.2 | 2026-02-20 | 前端重构为 Vite + React + Tailwind + shadcn/ui + Zustand |
| v1.3.1 | 2026-02-20 | 修复流式输出、配置持久化到 SQLite |
| v1.3.0 | 2026-02-20 | 添加历史会话记录，SQLite 持久化存储 |
| v1.2.0 | 2026-02-20 | 添加对话记忆功能 |
| v1.1.0 | - | 初始版本，支持双 API 格式 |

## 快速开始

```bash
# 安装依赖
npm install

# 编译并运行
npm start

# 开发模式 (需要同时运行 Vite 和 Electron)
npm run dev
```

## 项目结构

```
ai-desktop-assistant/
├── src/
│   ├── main.ts                 # Electron 主进程入口
│   ├── preload.ts              # 预加载脚本 (IPC 桥接)
│   ├── agent-service.ts        # AI 核心服务 (Claude Agent SDK)
│   ├── session-storage.ts      # SQLite 配置与会话元数据存储
│   ├── types/
│   │   └── index.ts            # 集中类型定义
│   ├── utils/
│   │   └── errors.ts           # 自定义错误类
│   ├── shared/
│   │   └── branding.ts         # 产品名称、图标
│   ├── ai/
│   │   └── protocol-translator/  # Anthropic ↔ OpenAI 协议翻译
│   ├── main-process/           # 主进程模块化拆分
│   │   ├── main-process-context.ts
│   │   ├── ipc/                # IPC 处理器分域
│   │   ├── mcp/                # MCP 配置管理
│   │   └── chat-input/         # @引用解析、路径补全
│   └── renderer/               # React 前端应用
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 根组件
│       ├── components/         # UI 组件
│       ├── stores/             # Zustand 状态管理
│       ├── services/           # API 客户端封装
│       ├── lib/                # 工具函数
│       └── styles/             # 全局样式
├── docs/                       # 项目文档
├── scripts/                    # 构建脚本
├── dist/                       # 编译输出
└── release/                    # 打包输出
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 28 |
| 语言 | TypeScript 5.3 |
| 前端框架 | React 19 |
| 构建工具 | Vite 7 (渲染层) + esbuild (主进程) |
| CSS 框架 | Tailwind CSS v4 |
| UI 组件 | shadcn/ui (Radix UI) |
| 状态管理 | Zustand |
| AI 核心 | @anthropic-ai/claude-agent-sdk |
| 数据库 | SQLite (better-sqlite3) |
| 打包工具 | electron-builder |
