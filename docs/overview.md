# AI Desktop Assistant - 项目概述

## 项目简介

AI Desktop Assistant 是一款基于 Electron + TypeScript 构建的跨平台桌面应用程序，提供统一的 AI 对话界面，支持多种 AI 提供商。

**核心特性：**
- **多提供商支持**：Anthropic Claude、OpenAI、Ollama、DeepSeek、Moonshot 等
- **OpenAI 兼容 API**：支持任何 OpenAI 兼容的服务端点
- **流式响应**：实时显示 AI 生成内容
- **响应取消**：支持中断正在进行的响应
- **安全存储**：使用 Electron `safeStorage` 加密 API Key
- **Markdown 增强**：支持代码块、链接等格式化

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 28 |
| 语言 | TypeScript 5.3 |
| AI SDK | @anthropic-ai/sdk, openai |
| 构建工具 | tsc (TypeScript Compiler) |
| 代码质量 | ESLint, Prettier |
| 打包工具 | electron-builder |

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
│   └── index.html           # UI 模板 (内含 CSS)
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
- 使用 `safeStorage` 进行敏感数据加密
- 处理流式响应的取消操作
- 处理应用退出时的资源清理

#### 2. preload.ts - 预加载脚本

安全桥接主进程与渲染进程：
- 使用 `contextBridge.exposeInMainWorld` 暴露受限 API
- 精确管理监听器引用，避免 `removeAllListeners` 导致的内存泄漏
- 定义 `ElectronAPI` 接口供 TypeScript 类型检查

#### 3. renderer.ts - 渲染进程

前端业务逻辑：
- `ChatApp` 类封装所有 UI 交互
- 预设配置管理 (Anthropic, OpenAI, Ollama, DeepSeek, Moonshot, Custom)
- 流式消息处理和渲染
- 响应取消功能
- 配置加密持久化
- Markdown 格式化（代码块、链接、粗体、斜体）

#### 4. claude-service.ts - AI 服务层

核心 AI 交互逻辑：
- 多提供商抽象：统一接口支持 Anthropic 和 OpenAI 兼容 API
- 流式响应：使用 AsyncGenerator 实现流式输出
- AbortController：支持取消正在进行的请求
- 配置管理：动态切换提供商、模型、API Key、Base URL、max_tokens
- 连接测试：验证 API 配置有效性

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

## 支持的 AI 提供商

### 内置预设

| 提供商 | Provider 类型 | 默认模型 | Base URL |
|--------|--------------|----------|----------|
| Anthropic Claude | `anthropic` | claude-opus-4-6 | - |
| OpenAI | `openai` | gpt-4o | https://api.openai.com/v1 |
| Ollama | `openai` | llama3.2 | http://localhost:11434/v1 |
| DeepSeek | `openai` | deepseek-chat | https://api.deepseek.com/v1 |
| Moonshot | `openai` | moonshot-v1-8k | https://api.moonshot.cn/v1 |

### 自定义端点

支持任何 OpenAI 兼容的 API 服务：
- vLLM
- LM Studio
- LocalAI
- 其他 OpenAI 兼容服务

## IPC 通信接口

### 渲染进程 → 主进程

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `send-message` | message, systemPrompt? | string | 发送消息并获取完整响应 |
| `send-message-stream` | message, systemPrompt? | boolean | 发送消息并流式接收响应 |
| `abort-stream` | - | void | 取消当前流式响应 |
| `set-model-config` | Partial\<ModelConfig\> | boolean | 设置模型配置 |
| `test-connection` | - | {success, message} | 测试 API 连接 |
| `encrypt-data` | data | string | 加密敏感数据 |
| `decrypt-data` | encryptedData | string | 解密敏感数据 |

### 主进程 → 渲染进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `stream-chunk` | {type, content} | 流式响应数据块 |

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
AI Provider API (Anthropic/OpenAI)
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

## 扩展方向

1. **会话管理**：支持多会话和历史记录
2. **系统提示词**：可自定义系统提示词模板
3. **消息导出**：导出对话为 Markdown/JSON
4. **快捷键**：全局快捷键唤醒
5. **托盘图标**：最小化到系统托盘
6. **多语言**：i18n 国际化支持
7. **代码高亮**：集成 highlight.js 或 prism.js
