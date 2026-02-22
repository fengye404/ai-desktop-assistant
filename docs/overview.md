# AI Desktop Assistant - 项目概述

## 项目简介

AI Desktop Assistant 是一款基于 Electron + TypeScript 构建的跨平台桌面应用程序，提供统一的 AI 对话界面，支持两种 API 格式。

**核心特性：**
- **多提供商模型接入**：支持 Anthropic 和 OpenAI 兼容 API
- **OpenAI 兼容生态**：支持 OpenAI、Ollama、DeepSeek、Moonshot、智谱 AI 等所有 OpenAI 兼容服务
- **流式响应渲染**：实时显示 AI 生成内容
- **工具系统**：9 个内置工具 + MCP 协议支持动态工具扩展
- **会话管理**：SQLite 持久化存储、多会话切换
- **安全存储**：使用 Electron `safeStorage` 加密 API Key
- **现代 UI**：React 19 + Tailwind CSS v4 + shadcn/ui (Glassmorphism 设计风格)

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
├── public/
│   └── index.html           # UI 模板
├── dist/                    # 编译输出
├── release/                 # 打包输出
├── docs/                    # 项目文档
├── package.json
├── tsconfig.json
├── electron-builder.yml     # 打包配置
├── .eslintrc.json           # ESLint 配置
└── .prettierrc              # Prettier 配置
```

## 架构设计

### 进程模型

Electron 采用多进程架构，本项目包含三个核心进程：

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  (main.ts)                                                  │
│  - 创建 BrowserWindow                                       │
│  - 注册 IPC 处理器                                          │
│  - 管理 ClaudeService 实例                                  │
│  - safeStorage 加密/解密                                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ IPC (Inter-Process Communication)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                           │
│  (preload.ts)                                               │
│  - contextBridge 暴露安全 API                               │
│  - 内联 IPC_CHANNELS 避免模块加载问题                       │
│  - 精确的监听器管理（避免内存泄漏）                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  (renderer.ts + index.html)                                 │
│  - UI 交互                                                  │
│  - 消息渲染                                                 │
│  - 配置管理（加密存储）                                     │
│  - 流式响应取消                                             │
└─────────────────────────────────────────────────────────────┘
```

### 模块职责

#### 1. main.ts - 主进程

负责应用生命周期和窗口管理：
- 创建并配置 BrowserWindow (1200x800, macOS 原生标题栏)
- 注册 IPC 处理器（消息发送、配置管理、加密存储）
- 初始化和管理 ClaudeService 单例
- 使用 `safeStorage` 进行敏感数据加密（含明文降级方案）
- 处理流式响应的取消操作
- 处理应用退出时的资源清理

#### 2. preload.ts - 预加载脚本

安全桥接主进程与渲染进程：
- 使用 `contextBridge.exposeInMainWorld` 暴露受限 API
- **内联 IPC_CHANNELS 常量**：避免模块导入问题
- 精确管理监听器引用，避免 `removeAllListeners` 导致的内存泄漏

#### 3. renderer.ts - 渲染进程

前端业务逻辑：
- `ChatApp` 类封装所有 UI 交互
- 简化的配置管理（Claude API / OpenAI 兼容 API 两种类型）
- 流式消息处理和渲染
- 响应取消功能
- 配置加密持久化
- Markdown 格式化（代码块、链接、粗体、斜体）

#### 4. claude-service.ts - AI 服务层

核心 AI 交互逻辑：
- 双提供商抽象：支持 Claude API 和 OpenAI 兼容 API
- 流式响应：使用 AsyncGenerator 实现流式输出
- AbortController：支持取消正在进行的请求
- 配置管理：动态切换提供商、模型、API Key、Base URL
- 连接测试：15 秒超时机制，完善的错误处理

#### 5. types/index.ts - 类型定义

集中管理所有共享类型：
- `ModelConfig`：模型配置接口
- `StreamChunk`：流式响应数据结构
- `ElectronAPI`：暴露给渲染进程的 API 类型
- `IPC_CHANNELS`：IPC 通道名称常量

#### 6. utils/errors.ts - 错误处理

自定义错误类：
- `APIKeyError`：API 密钥错误
- `APIRequestError`：API 请求错误
- `StreamAbortedError`：流式响应被取消
- `EncryptionError`：加密/解密错误
- `getErrorMessage()`：生成用户友好的错误消息

## API 配置

### 支持的 API 类型

| API 类型 | 说明 | 适用场景 |
|---------|------|---------|
| Claude API | Anthropic 官方 API 或兼容端点 | Claude 系列模型 |
| OpenAI 兼容 API | 任何 OpenAI 兼容的服务端点 | OpenAI、Ollama、DeepSeek、Moonshot、智谱 AI 等 |

### 配置示例

#### Claude API
```
API 类型: Claude API (Anthropic)
模型: claude-opus-4-6
API Key: your-api-key
Base URL: (留空使用官方，或填写自定义端点)
```

#### OpenAI 官方
```
API 类型: OpenAI 兼容 API
模型: gpt-4o
API Key: your-openai-key
Base URL: (留空使用默认)
```

#### DeepSeek
```
API 类型: OpenAI 兼容 API
模型: deepseek-chat
API Key: your-deepseek-key
Base URL: https://api.deepseek.com/v1
```

#### Ollama (本地)
```
API 类型: OpenAI 兼容 API
模型: llama3.2
API Key: ollama (任意值)
Base URL: http://localhost:11434/v1
```

#### 智谱 AI
```
API 类型: OpenAI 兼容 API
模型: glm-4
API Key: your-zhipu-key
Base URL: https://open.bigmodel.cn/api/paas/v4
```

## IPC 通信接口

### 渲染进程 → 主进程

#### 消息相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `send-message` | message, systemPrompt? | string | 发送消息并获取完整响应 |
| `send-message-stream` | message, systemPrompt? | boolean | 发送消息并流式接收响应 |
| `abort-stream` | - | void | 取消当前流式响应 |
| `clear-history` | - | void | 清除对话历史 |
| `get-history` | - | ChatMessage[] | 获取对话历史 |
| `compact-history` | - | CompactHistoryResult | 压缩对话历史 |

#### 配置相关

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `set-model-config` | Partial\<ModelConfig\> | boolean | 设置模型配置 |
| `config-save` | Partial\<ModelConfig\> | boolean | 保存配置到持久化存储 |
| `config-load` | - | Partial\<ModelConfig\> | 从持久化存储加载配置 |
| `test-connection` | - | {success, message} | 测试 API 连接 (15秒超时) |
| `encrypt-data` | data | string | 加密敏感数据 |
| `decrypt-data` | encryptedData | string | 解密敏感数据 |

#### 会话管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `session-list` | - | SessionMeta[] | 获取会话列表 |
| `session-get` | id | Session \| null | 获取指定会话 |
| `session-create` | title? | Session | 创建新会话 |
| `session-delete` | id | boolean | 删除会话 |
| `session-switch` | id | Session \| null | 切换到指定会话 |
| `session-rename` | id, title | boolean | 重命名会话 |

#### MCP 管理

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `mcp-list-servers` | - | McpServerStatus[] | 获取 MCP 服务器列表 |
| `mcp-list-tools` | - | McpToolInfo[] | 获取 MCP 工具列表 |
| `mcp-refresh` | - | McpRefreshResult | 刷新 MCP 状态 |
| `mcp-upsert-server` | name, config | McpRefreshResult | 添加或更新 MCP 服务器 |
| `mcp-remove-server` | name | McpRefreshResult | 移除 MCP 服务器 |

### 主进程 → 渲染进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `stream-chunk` | {type, content} | 流式响应数据块 |
| `tool-approval-request` | ToolApprovalRequest | 工具执行审批请求 |

## 数据流

```
用户输入 → renderer.ts (sendMessage)
    ↓
preload.ts (electronAPI.sendMessageStream)
    ↓
main.ts (IPC Handler)
    ↓
claude-service.ts (sendMessageStream)
    ↓
AI Provider API (Anthropic/OpenAI Compatible)
    ↓
流式响应 → main.ts (webContents.send)
    ↓
renderer.ts (onStreamChunk callback)
    ↓
UI 更新
```

## 安全设计

### 1. API Key 加密存储

使用 Electron `safeStorage` API 加密敏感数据：
- **macOS**：使用 Keychain Access
- **Windows**：使用 DPAPI
- **Linux**：使用 Secret Service (如 GNOME Keyring)

**降级方案**：当加密不可用时，自动降级为明文存储（带 `plain:` 前缀标识）

```typescript
// 加密
const encrypted = await window.electronAPI.encryptData(apiKey);

// 解密
const decrypted = await window.electronAPI.decryptData(encrypted);
```

### 2. 其他安全措施

1. **上下文隔离**：`contextIsolation: true`
2. **禁用 Node 集成**：`nodeIntegration: false`
3. **Content Security Policy**：限制脚本来源
4. **预加载脚本**：仅暴露必要的 IPC 通道
5. **精确监听器管理**：避免 `removeAllListeners` 安全风险

## 构建与运行

```bash
# 安装依赖
npm install

# 编译并运行
npm start

# 开发模式
npm run dev

# 代码检查
npm run lint

# 格式化代码
npm run format

# 打包（当前平台）
npm run dist

# 打包 macOS
npm run dist:mac

# 打包 Windows
npm run dist:win
```

## 打包配置

使用 `electron-builder` 进行打包，支持：

### macOS
- DMG 安装镜像
- ZIP 压缩包
- 支持 Intel (x64) 和 Apple Silicon (arm64)

### Windows
- NSIS 安装程序
- 便携版 (portable)

配置文件：`electron-builder.yml`

## 常见问题

### Settings 按钮无法点击

确保应用正确加载了 preload 脚本。如果 `window.electronAPI` 为 undefined，说明 preload 脚本加载失败。

### 连接测试超时

1. 检查网络连接
2. 确认 API 地址正确
3. 确认选择了正确的 API 类型（Claude API vs OpenAI 兼容 API）

### API Key 无法加密

当系统不支持安全存储时（如 Linux 无 Keyring），会自动降级为明文存储。这不影响功能使用。

## 扩展方向

1. **会话管理**：✅ 已实现 SQLite 持久化存储、多会话切换
2. **系统提示词**：可自定义系统提示词模板
3. **消息导出**：导出对话为 Markdown/JSON
4. **快捷键**：全局快捷键唤醒
5. **托盘图标**：最小化到系统托盘
6. **多语言**：i18n 国际化支持
7. **代码高亮**：✅ 已集成 react-syntax-highlighter
8. **MCP 协议**：✅ 已实现 Stdio/SSE/HTTP 三种传输方式
