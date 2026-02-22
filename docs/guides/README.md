# 使用指南

本文档提供 AI Desktop Assistant 的配置说明和常见问题解答。

## 优化记录

- [启动黑屏排查指南（2026-02-21）](./startup-black-screen-troubleshooting-2026-02-21.md)
- [页面展示与性能优化记录（2026-02-21）](./ui-performance-optimization-2026-02-21.md)
- [UI 视觉修复记录（2026-02-21）](./ui-visual-polish-2026-02-21.md)
- [主题色规范（2026-02-22）](./theme-color-spec-2026-02-22.md)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行应用

```bash
npm start
```

### 3. 配置 API

点击右上角的 **Settings** 按钮，配置 API 信息后点击"保存配置"。

## API 配置

### 支持的 API 类型

| API 类型 | 说明 | 适用场景 |
|---------|------|---------|
| Anthropic API | Anthropic 官方 API | Anthropic 系列模型 |
| OpenAI 兼容 API | 任何 OpenAI 兼容服务 | OpenAI、Ollama、DeepSeek 等 |

### 配置示例

#### Anthropic API (Anthropic)

```
API 类型: Anthropic API (Anthropic)
模型: gpt-4o-mini
API Key: sk-ant-xxxxx
Base URL: (留空使用官方)
```

#### OpenAI

```
API 类型: OpenAI 兼容 API
模型: gpt-4o
API Key: sk-xxxxx
Base URL: (留空使用默认)
```

#### DeepSeek

```
API 类型: OpenAI 兼容 API
模型: deepseek-chat
API Key: sk-xxxxx
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
API Key: xxxxx.xxxxx
Base URL: https://open.bigmodel.cn/api/paas/v4
```

#### Moonshot

```
API 类型: OpenAI 兼容 API
模型: moonshot-v1-8k
API Key: sk-xxxxx
Base URL: https://api.moonshot.cn/v1
```

## 功能使用

### 多轮对话

现在应用支持多轮对话，AI 会记住之前的对话内容：

1. 正常输入消息并发送
2. AI 会根据上下文理解你的问题
3. 对话历史会自动保存（最多 50 条）

### 清除对话

点击输入框左侧的"清除"按钮，可以清空当前对话历史，开始新的对话。

### 取消响应

在 AI 响应过程中，点击"取消"按钮可以中断当前响应。

### 测试连接

配置完 API 后，点击"测试连接"按钮验证配置是否正确。

## 构建命令

```bash
# 开发运行
npm start

# 开发模式（热重载）
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

## 常见问题

### Settings 按钮无法点击

**原因**：preload 脚本加载失败

**解决方案**：
1. 确保 `dist/preload.js` 文件存在
2. 运行 `npm run build` 重新编译

### 连接测试超时

**可能原因**：
1. 网络连接问题
2. API 地址不正确
3. 选择了错误的 API 类型

**解决方案**：
1. 检查网络连接
2. 确认 API 地址正确
3. Anthropic 模型选择 "Anthropic API"，其他选择 "OpenAI 兼容 API"

### API Key 无法保存

**原因**：系统不支持安全存储

**说明**：在某些 Linux 系统上，如果没有安装 Keyring，会自动降级为明文存储。这不影响功能使用，但安全性较低。

### AI 不记得之前的对话

**原因**：可能是旧版本

**解决方案**：
1. 更新到 v1.2.0 或更高版本
2. 运行 `npm run build` 重新编译

### 对话历史丢失

**说明**：当前版本的对话历史存储在内存中，应用重启后会丢失。这是预期行为，未来版本会添加持久化功能。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |

## 系统要求

- **macOS**: 10.13 或更高
- **Windows**: Windows 10 或更高
- **Linux**: 支持大多数发行版

## 获取帮助

如果遇到问题，请检查：

1. 是否使用了最新版本
2. API 配置是否正确
3. 网络连接是否正常

如果问题仍然存在，请提交 Issue。
