# AI Desktop Assistant - 项目概述

## 项目简介

AI Desktop Assistant 是一款基于 Electron + TypeScript 构建的跨平台桌面应用程序，核心架构围绕 **Claude Agent SDK** 构建，提供统一的 AI 对话界面。通过内置的协议翻译层，同时支持 Anthropic 和 OpenAI 兼容的第三方提供商。

**核心特性：**
- **Agent SDK 驱动**：AI 交互、工具执行、Agentic Loop 由 Claude Agent SDK 处理
- **多提供商支持**：Anthropic 直连 + OpenAI 兼容生态（通过协议翻译代理）
- **流式响应渲染**：实时显示 AI 生成内容，工具调用卡片内联展示
- **MCP 协议支持**：Stdio/SSE/HTTP 三种传输方式的动态工具扩展
- **会话管理**：SDK 管理消息持久化，SQLite 存储配置与会话元数据
- **安全存储**：使用 Electron `safeStorage` 加密 API Key
- **现代 UI**：React 19 + Tailwind CSS v4 + shadcn/ui (Glassmorphism 设计风格)

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 28 |
| 语言 | TypeScript 5.3 |
| 前端框架 | React 19 |
| 主进程构建 | esbuild |
| 渲染层构建 | Vite 7 |
| CSS 框架 | Tailwind CSS v4 |
| UI 组件 | shadcn/ui (Radix UI) |
| 状态管理 | Zustand |
| AI 核心 | @anthropic-ai/claude-agent-sdk |
| 数据库 | SQLite (better-sqlite3) |
| 打包工具 | electron-builder |

## 项目结构

```
ai-desktop-assistant/
├── src/
│   ├── main.ts                 # Electron 主进程入口
│   ├── preload.ts              # 预加载脚本 (IPC 桥接)
│   ├── agent-service.ts        # AI 核心服务 (Claude Agent SDK 封装)
│   ├── session-storage.ts      # SQLite 配置与会话元数据存储
│   ├── types/
│   │   └── index.ts            # 集中类型定义
│   ├── utils/
│   │   └── errors.ts           # 自定义错误类
│   ├── shared/
│   │   └── branding.ts         # 产品名称、图标路径
│   ├── ai/
│   │   └── protocol-translator/  # Anthropic ↔ OpenAI 协议翻译代理
│   ├── main-process/           # 主进程模块化拆分
│   │   ├── main-process-context.ts  # 运行时上下文容器
│   │   ├── window-factory.ts        # BrowserWindow 工厂
│   │   ├── tool-approval-coordinator.ts
│   │   ├── ipc/                # IPC 处理器分域
│   │   ├── mcp/                # MCP 配置管理
│   │   └── chat-input/         # @引用解析、路径补全
│   └── renderer/               # React 前端应用
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 根组件 (Sidebar + ChatArea + Settings)
│       ├── components/         # UI 组件
│       │   ├── ui/             # shadcn/ui 基础组件
│       │   ├── Sidebar.tsx     # 会话侧边栏
│       │   ├── ChatArea.tsx    # 聊天主区域
│       │   ├── SettingsDialog.tsx
│       │   ├── ToolCallBlock.tsx    # 工具调用卡片 + 内联审批
│       │   └── MarkdownRenderer.tsx
│       ├── stores/             # Zustand 状态管理
│       │   ├── chat-store.ts   # 聊天流程编排
│       │   ├── session-store.ts  # 会话列表
│       │   ├── config-store.ts   # 模型配置
│       │   ├── chat-stream-listener.ts  # 流式 chunk 消费
│       │   └── chat-stream-state.ts     # 流式状态纯 reducer
│       ├── services/
│       │   └── electron-api-client.ts   # IPC 安全封装
│       ├── lib/
│       │   └── utils.ts
│       └── styles/
│           └── globals.css
├── public/
│   └── branding/               # 图标资源
├── scripts/                    # 构建脚本
├── dist/                       # 编译输出
├── release/                    # 打包输出
├── docs/                       # 项目文档
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.yml
```

## 架构设计

### 进程模型

Electron 多进程架构，三个核心层：

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  main.ts → MainProcessContext                               │
│  - AgentService: Claude Agent SDK 交互                      │
│  - SessionStorage: SQLite 配置/元数据                       │
│  - ToolApprovalCoordinator: 工具审批桥接                    │
│  - IPC Handlers: 分域注册 (chat/session/config/mcp/...)     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ IPC (contextBridge)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                           │
│  preload.ts                                                 │
│  - contextBridge 暴露受限 electronAPI                       │
│  - 内联 IPC_CHANNELS（沙箱限制）                           │
│  - 单监听器替换策略（防止内存泄漏）                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  React 19 + Zustand + Tailwind v4                          │
│  - components/: UI 组件层                                   │
│  - stores/: 状态与流程编排                                  │
│  - services/electron-api-client: IPC 安全封装               │
│  - stream pipeline: listener → pure reducer → UI            │
└─────────────────────────────────────────────────────────────┘
```

### 核心服务

| 服务 | 文件 | 职责 |
|------|------|------|
| AgentService | `agent-service.ts` | Claude Agent SDK 封装，流式消息、MCP、工具审批 |
| SessionStorage | `session-storage.ts` | SQLite 持久化：提供商配置、MCP 配置、会话元数据 |
| ToolApprovalCoordinator | `tool-approval-coordinator.ts` | SDK canUseTool 回调与渲染层 UI 审批的异步桥接 |
| McpManager | `mcp/mcp-manager.ts` | MCP 服务器配置的增删改查 |
| Protocol Translator | `ai/protocol-translator/` | Anthropic ↔ OpenAI 格式的 HTTP 协议翻译代理 |

### 数据流

```
用户输入 → ChatArea Composer
    → chat-store.sendMessage()
    → electronApiClient.sendMessageStream()
    → preload (ipcRenderer.invoke)
    → chat-handlers → AgentService.sendMessageStream()
    → Claude Agent SDK query()
    → SDK Messages → mapSdkMessageToChunks() → StreamChunk[]
    → sendStreamChunk() → webContents.send('stream-chunk')
    → preload (ipcRenderer.on)
    → chat-stream-listener → chat-stream-state (pure reducers)
    → chat-store → UI 重渲染
```

## API 配置

### 支持的提供商

| 提供商类型 | 说明 | 实现方式 |
|---------|------|---------|
| Anthropic | Claude 系列模型 | Agent SDK 直连 |
| OpenAI 兼容 | OpenAI、Ollama、DeepSeek、Moonshot 等 | 本地协议翻译代理 |

### 配置示例

#### Claude API (Anthropic)
```
提供商: Anthropic
模型: claude-sonnet-4-6
API Key: your-api-key
```

#### OpenAI 官方
```
提供商: OpenAI 兼容
模型: gpt-4o
API Key: your-openai-key
Base URL: https://api.openai.com/v1
```

#### DeepSeek
```
提供商: OpenAI 兼容
模型: deepseek-chat
API Key: your-deepseek-key
Base URL: https://api.deepseek.com/v1
```

#### Ollama (本地)
```
提供商: OpenAI 兼容
模型: llama3.2
API Key: ollama
Base URL: http://localhost:11434/v1
```

## IPC 通信接口

详见 [API 参考](./api/README.md)。

### 渲染进程 → 主进程 (关键通道)

| 通道 | 说明 |
|------|------|
| `send-message-stream` | 流式发送消息 |
| `abort-stream` | 取消当前流 |
| `session-list/create/switch/delete/rename` | 会话管理 |
| `config-save/load` | 配置持久化 |
| `mcp-*` | MCP 服务器管理 |

### 主进程 → 渲染进程

| 通道 | 说明 |
|------|------|
| `stream-chunk` | 流式响应数据块 |
| `tool-approval-request` | 工具执行审批请求 |

## 安全设计

1. **上下文隔离**：`contextIsolation: true`，`nodeIntegration: false`
2. **API Key 加密**：使用 Electron `safeStorage`（macOS Keychain / Windows DPAPI / Linux Secret Service）
3. **预加载脚本**：仅暴露声明的 IPC 通道方法
4. **单监听器策略**：防止事件监听器累积

## 构建与运行

```bash
# 安装依赖
npm install

# 编译并运行
npm start

# 开发模式
npm run dev

# 代码检查与格式化
npm run lint
npm run format

# 运行测试
npm run test:chat-stream

# 打包
npm run dist        # 当前平台
npm run dist:mac    # macOS
npm run dist:win    # Windows
```
