# 使用指南

本文档提供 AI Desktop Assistant 的配置说明和常见问题解答。

## 优化记录

- [启动黑屏排查指南（2026-02-21）](./startup-black-screen-troubleshooting-2026-02-21.md)
- [页面展示与性能优化记录（2026-02-21）](./ui-performance-optimization-2026-02-21.md)
- [UI 视觉修复记录（2026-02-21）](./ui-visual-polish-2026-02-21.md)
- [主题色规范（2026-02-22）](./theme-color-spec-2026-02-22.md)
- [Icon 处理与替换手册（2026-02-23）](./icon-branding-workflow-temporary-2026-02-23.md)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行应用

```bash
npm start
```

### 3. 配置提供商

打开设置面板，配置 AI 提供商信息（提供商名称、协议、API Key、模型）。

## API 配置

### 支持的提供商类型

| 协议类型 | 说明 | 实现方式 |
|---------|------|---------|
| Anthropic | Claude 系列模型 | Agent SDK 直连 |
| OpenAI 兼容 | 任何 OpenAI 兼容服务 | 本地协议翻译代理 |

### 配置示例

#### Anthropic (Claude)

```
协议: Anthropic
模型: claude-sonnet-4-6
API Key: sk-ant-xxxxx
```

#### OpenAI

```
协议: OpenAI 兼容
模型: gpt-4o
API Key: sk-xxxxx
Base URL: https://api.openai.com/v1
```

#### DeepSeek

```
协议: OpenAI 兼容
模型: deepseek-chat
API Key: sk-xxxxx
Base URL: https://api.deepseek.com/v1
```

#### Ollama (本地)

```
协议: OpenAI 兼容
模型: llama3.2
API Key: ollama
Base URL: http://localhost:11434/v1
```

#### 智谱 AI

```
协议: OpenAI 兼容
模型: glm-4
API Key: xxxxx.xxxxx
Base URL: https://open.bigmodel.cn/api/paas/v4
```

#### Moonshot

```
协议: OpenAI 兼容
模型: moonshot-v1-8k
API Key: sk-xxxxx
Base URL: https://api.moonshot.cn/v1
```

## 功能使用

### 多轮对话

Agent SDK 自动管理对话上下文：

1. 正常输入消息并发送
2. AI 会根据上下文理解你的问题
3. 对话由 SDK 持久化，切换会话可恢复

### 会话管理

- **新建对话**：点击侧边栏"+ 新对话"
- **切换对话**：点击侧边栏中的会话项
- **重命名**：点击会话项的重命名按钮
- **删除**：点击会话项的删除按钮

### 斜杠命令

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清除当前对话 |
| `/compact` | 压缩对话历史 |
| `/config` | 打开设置 |
| `/model` | 切换模型 |

### @ 文件引用

输入 `@` 后跟文件路径可以引用本地文件，支持路径自动补全。

### 图片附件

- 直接粘贴图片
- 拖拽图片到输入框
- 最多 6 张，单张不超过 8MB

### 取消响应

在 AI 响应过程中，点击停止按钮或按 Esc 可以中断当前响应。

### 恢复操作

按两次 Esc 打开恢复菜单，可以撤销最后一轮或清除对话。

## 构建命令

```bash
# 开发模式（热重载）
npm run dev

# 编译并运行
npm start

# 代码检查
npm run lint

# 格式化代码
npm run format

# 运行测试
npm run test:chat-stream

# 打包（当前平台）
npm run dist

# 打包 macOS
npm run dist:mac

# 打包 Windows
npm run dist:win
```

## 常见问题

### 启动后黑屏

**解决方案**：
1. 运行 `npm run build` 重新编译
2. 确认 `dist/preload.js` 和 `dist/renderer/` 存在
3. 详见 [启动黑屏排查指南](./startup-black-screen-troubleshooting-2026-02-21.md)

### 连接测试失败

**可能原因**：
1. 网络连接问题
2. API 地址不正确
3. OpenAI 兼容提供商未填写 Base URL

### API Key 无法加密

在某些 Linux 系统上（无 Keyring），会自动降级为明文存储。功能不受影响，但安全性较低。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `Esc` | 取消流式响应 |
| `Esc + Esc` | 打开恢复菜单 |
| `/` | 触发斜杠命令 |
| `@` | 触发文件路径补全 |

## 系统要求

- **macOS**: 10.13+（Intel 或 Apple Silicon）
- **Windows**: Windows 10+
- **Linux**: 支持大多数发行版
