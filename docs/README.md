# AI Desktop Assistant 文档中心

> 基于 Electron + TypeScript 构建的跨平台 AI 对话桌面应用

## 产品定位

AI Desktop Assistant 定位为类似 **Anthropic Claude Desktop** 的桌面 AI 协作工具，提供流畅的多轮对话体验、本地文件集成和可扩展的工具系统。

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
| v1.2.0 | 2026-02-20 | 添加对话记忆功能 |
| v1.1.0 | - | 初始版本，支持双 API 格式 |

## 快速开始

```bash
# 安装依赖
npm install

# 编译并运行
npm start

# 开发模式
npm run dev
```

## 项目结构

```
ai-desktop-assistant/
├── src/
│   ├── main.ts              # Electron 主进程
│   ├── preload.ts           # 预加载脚本 (IPC 桥接)
│   ├── renderer.ts          # 渲染进程 (前端逻辑)
│   ├── claude-service.ts    # AI 服务层 (多提供商支持)
│   ├── types/
│   │   └── index.ts         # 集中类型定义
│   └── utils/
│       └── errors.ts        # 自定义错误类
├── public/
│   └── index.html           # UI 模板
├── docs/                    # 项目文档
│   ├── README.md            # 文档索引 (本文件)
│   ├── overview.md          # 项目概述
│   ├── architecture/        # 架构文档
│   ├── features/            # 功能文档
│   ├── api/                 # API 文档
│   └── guides/              # 使用指南
├── dist/                    # 编译输出
└── release/                 # 打包输出
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 28 |
| 语言 | TypeScript 5.3 |
| AI SDK | @anthropic-ai/sdk, openai |
| 构建工具 | tsc (TypeScript Compiler) |
| 打包工具 | electron-builder |
