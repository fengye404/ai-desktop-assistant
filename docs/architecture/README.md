# 架构设计

本文档描述 AI Desktop Assistant 的整体架构设计。

## 进程模型

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

## 模块职责

### 1. main.ts - 主进程

负责应用生命周期和窗口管理：

- 创建并配置 BrowserWindow (1200x800, macOS 原生标题栏)
- 注册 IPC 处理器（消息发送、配置管理、加密存储）
- 初始化和管理 ClaudeService 单例
- 使用 `safeStorage` 进行敏感数据加密（含明文降级方案）
- 处理流式响应的取消操作
- 处理应用退出时的资源清理

### 2. preload.ts - 预加载脚本

安全桥接主进程与渲染进程：

- 使用 `contextBridge.exposeInMainWorld` 暴露受限 API
- **内联 IPC_CHANNELS 常量**：避免模块导入问题
- 精确管理监听器引用，避免 `removeAllListeners` 导致的内存泄漏

### 3. renderer.ts - 渲染进程

前端业务逻辑：

- `ChatApp` 类封装所有 UI 交互
- 简化的配置管理（Claude API / OpenAI 兼容 API 两种类型）
- 流式消息处理和渲染
- 响应取消功能
- 配置加密持久化
- Markdown 格式化（代码块、链接、粗体、斜体）

### 4. claude-service.ts - AI 服务层

核心 AI 交互逻辑：

- 双提供商抽象：支持 Claude API 和 OpenAI 兼容 API
- **对话记忆**：维护消息历史，支持多轮对话
- 流式响应：使用 AsyncGenerator 实现流式输出
- AbortController：支持取消正在进行的请求
- 配置管理：动态切换提供商、模型、API Key、Base URL
- 连接测试：15 秒超时机制，完善的错误处理

### 5. types/index.ts - 类型定义

集中管理所有共享类型：

- `ModelConfig`：模型配置接口
- `ChatMessage`：对话消息结构
- `StreamChunk`：流式响应数据结构
- `ElectronAPI`：暴露给渲染进程的 API 类型
- `IPC_CHANNELS`：IPC 通道名称常量

### 6. utils/errors.ts - 错误处理

自定义错误类：

- `APIKeyError`：API 密钥错误
- `APIRequestError`：API 请求错误
- `StreamAbortedError`：流式响应被取消
- `EncryptionError`：加密/解密错误
- `getErrorMessage()`：生成用户友好的错误消息

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
    ├── 添加用户消息到历史
    ├── 发送完整历史给 AI
    └── 收集并保存 AI 响应到历史
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

### 2. 上下文隔离

- `contextIsolation: true` - 启用上下文隔离
- `nodeIntegration: false` - 禁用 Node 集成
- Content Security Policy - 限制脚本来源
- 预加载脚本仅暴露必要的 IPC 通道
