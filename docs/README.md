# AI Desktop Assistant 文档中心

> 基于 Electron + Vite + React + Tailwind CSS 构建的跨平台 AI 对话桌面应用

## 产品定位

AI Desktop Assistant 定位为类似 **Anthropic AI Cowork** 的桌面 AI 协作工具，提供流畅的多轮对话体验、本地文件集成和可扩展的工具系统。

## 文档目录

### 核心文档

| 文档 | 说明 |
|------|------|
| [项目概述](./overview.md) | 项目简介、技术栈、整体架构 |
| [产品路线图](./roadmap.md) | 未来发展方向、功能规划 |

### 模块文档

| 模块 | 说明 |
|------|------|
| [架构设计](./architecture/README.md) | 进程模型、模块职责、数据流 |
| [功能特性](./features/README.md) | 各功能模块的详细说明 |
| [API 参考](./api/README.md) | IPC 通信接口、类型定义 |
| [使用指南](./guides/README.md) | 配置说明、常见问题 |

### 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.6.9 | 2026-02-21 | UI 视觉修复：移除顶部 bridge 警告横幅、优化会话列表与滚动条、重做工具自动执行配置样式 |
| v1.6.8 | 2026-02-21 | 启动韧性重构：新增渲染错误边界、主进程挂载健康探针、加载失败诊断页，黑屏可恢复可定位 |
| v1.6.7 | 2026-02-21 | 渲染层黑屏兜底：Electron bridge 缺失时安全降级，初始化监听器增加异常防护 |
| v1.6.6 | 2026-02-21 | Claude Provider Adapter 接口化：provider 分发由条件分支升级为注册表模式 |
| v1.6.5 | 2026-02-21 | Chat Stream Listener runtime 重构：抽离缓冲/队列流程并补齐 11 条回放单测 |
| v1.6.4 | 2026-02-21 | 增加 Chat Stream State 回放单测：Node 内置测试 + 独立编译配置 + 可执行脚本 |
| v1.6.3 | 2026-02-21 | Chat Store 流式状态重构：提炼纯 reducer 模块，store 聚焦流程编排 |
| v1.6.2 | 2026-02-21 | Claude Service 服务层重构：provider 流式模块拆分、常量模块化、编排层收敛 |
| v1.6.1 | 2026-02-21 | 系统架构分析与优化：IPC 分域模块化、安全处理提纯、文档补全 |
| v1.6.0 | 2026-02-21 | 前端与客户端架构重构：主进程分层、IPC 契约统一、store-service 解耦 |
| v1.5.1 | 2026-02-21 | 页面展示与性能优化：首屏瘦身、懒加载高亮、可访问性增强 |
| v1.5.0 | 2026-02-21 | 工具调用 UI 展示、权限设置、会话级确认、gzip 持久化 |
| v1.4.0 | 2026-02-21 | 工具系统：实现 Agentic Loop、9 个内置工具、权限控制 |
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
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本 (IPC 桥接)
│   ├── renderer.ts          # 渲染进程桥接
│   ├── claude-service.ts    # AI 服务层 (多提供商支持)
│   ├── session-storage.ts   # 会话存储服务 (SQLite)
│   ├── tool-executor.ts     # 工具执行器 (9 个内置工具)
│   ├── types/
│   │   └── index.ts         # 集中类型定义
│   ├── utils/
│   │   └── errors.ts        # 自定义错误类
│   ├── ai/                  # AI 提供商适配器
│   │   ├── providers/       # Anthropic/OpenAI 流式适配器
│   │   └── provider-streams.ts
│   ├── main-process/        # 主进程模块化拆分
│   │   ├── ipc/             # IPC 处理器分域
│   │   ├── mcp/             # MCP 协议实现
│   │   └── chat-input/      # 聊天输入处理
│   └── renderer/            # React 前端应用
│       ├── main.tsx         # React 入口
│       ├── App.tsx          # 根组件
│       ├── components/      # UI 组件
│       │   ├── ui/          # shadcn/ui 基础组件
│       │   ├── Sidebar.tsx
│       │   ├── ChatArea.tsx
│       │   ├── SettingsDialog.tsx
│       │   ├── ToolCallBlock.tsx
│       │   └── MarkdownRenderer.tsx
│       ├── stores/          # Zustand 状态管理
│       │   ├── config-store.ts
│       │   ├── session-store.ts
│       │   └── chat-store.ts
│       ├── services/        # API 客户端封装
│       │   └── electron-api-client.ts
│       ├── lib/
│       │   └── utils.ts     # 工具函数
│       └── styles/
│           └── globals.css  # 全局样式
├── docs/                    # 项目文档
├── dist/                    # 编译输出
│   ├── *.js                 # 主进程编译结果
│   └── renderer/            # Vite 构建的前端
└── release/                 # 打包输出
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 28 |
| 语言 | TypeScript 5.3 |
| 前端框架 | React 19 |
| 构建工具 | Vite 7 |
| CSS 框架 | Tailwind CSS v4 |
| UI 组件 | shadcn/ui (Radix UI) |
| 状态管理 | Zustand |
| AI SDK | @anthropic-ai/sdk, openai |
| 数据库 | SQLite (better-sqlite3) |
| 打包工具 | electron-builder |
