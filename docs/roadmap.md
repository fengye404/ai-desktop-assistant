# 产品路线图

> AI Desktop Assistant 未来发展方向与功能规划

## 产品定位

**AI Desktop Assistant** 定位为一款类似 Anthropic Claude Desktop 的桌面 AI 协作工具，提供：

- 流畅的多轮对话体验
- 本地文件与项目的深度集成
- 多 AI 提供商支持
- 可扩展的工具和插件系统

## 功能模块概览

| 优先级 | 模块 | 当前状态 | 目标版本 |
|--------|------|----------|----------|
| P0 | [会话管理](#1-会话管理-session-management) | 基础 | v1.3 |
| P0 | [工具系统](#2-工具系统-tools) | 未实现 | v1.4 |
| P1 | [MCP 协议支持](#3-mcp-协议支持) | 未实现 | v1.5 |
| P1 | [Agent 系统](#4-agent-系统) | 未实现 | v1.6 |
| P2 | [自定义命令](#5-自定义命令-commands) | 未实现 | v1.7 |
| P2 | [多提供商管理](#6-多提供商管理) | 基础 | v1.8 |
| P3 | [UI/UX 增强](#7-uiux-增强) | 基础 | v2.0 |

---

## 1. 会话管理 (Session Management)

### 当前状态
- [x] 对话记忆（内存）
- [x] 清除对话
- [ ] 会话持久化

### 计划功能

#### 1.1 会话持久化
```
存储位置: ~/.ai-desktop-assistant/sessions/
格式: JSON 或 SQLite
```

- 自动保存对话历史到本地
- 应用重启后恢复会话
- 支持多会话管理

#### 1.2 会话列表
- 会话历史列表展示
- 按时间/名称搜索
- 会话重命名和删除

#### 1.3 会话导出
- 导出为 Markdown
- 导出为 JSON
- 分享链接生成

#### 1.4 撤销/重做
- `/undo` - 撤销上一轮对话
- `/redo` - 重做撤销的对话
- 保留操作历史栈

#### 1.5 上下文压缩
- 当对话过长时自动压缩
- 保留关键信息的摘要
- 避免超出模型上下文窗口

---

## 2. 工具系统 (Tools)

### 设计目标
让 AI 能够执行实际操作，而不仅仅是对话。

### 核心工具

#### 2.1 文件操作
| 工具 | 功能 | 权限控制 |
|------|------|----------|
| `read` | 读取文件内容 | allow |
| `write` | 创建/覆盖文件 | ask |
| `edit` | 精确编辑文件 | ask |
| `list` | 列出目录内容 | allow |
| `glob` | 模式匹配搜索文件 | allow |
| `grep` | 正则搜索文件内容 | allow |

#### 2.2 Shell 执行
```typescript
interface BashTool {
  command: string;
  workingDirectory?: string;
  timeout?: number;
}
```

- 执行 shell 命令
- 捕获 stdout/stderr
- 支持超时控制
- 危险命令确认

#### 2.3 Web 访问
| 工具 | 功能 |
|------|------|
| `webfetch` | 获取网页内容 |
| `websearch` | 网络搜索 |

#### 2.4 权限系统
```json
{
  "permission": {
    "read": "allow",
    "write": "ask",
    "edit": "ask",
    "bash": "ask",
    "webfetch": "allow"
  }
}
```

权限级别：
- `allow` - 自动允许
- `ask` - 每次询问用户
- `deny` - 禁止使用

---

## 3. MCP 协议支持

### Model Context Protocol

MCP (Model Context Protocol) 是 Anthropic 提出的开放协议，允许 AI 应用连接外部工具和数据源。

### 3.1 本地 MCP 服务器
```json
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@anthropic/mcp-server-filesystem"],
      "enabled": true
    }
  }
}
```

### 3.2 远程 MCP 服务器
```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://mcp.github.com",
      "oauth": {}
    }
  }
}
```

### 3.3 常用 MCP 服务器
| 服务器 | 功能 |
|--------|------|
| filesystem | 文件系统访问 |
| github | GitHub 集成 |
| gitlab | GitLab 集成 |
| postgres | 数据库查询 |
| slack | Slack 消息 |
| notion | Notion 文档 |

---

## 4. Agent 系统

### 4.1 主代理 (Primary Agents)

#### Build Agent
- 默认代理，拥有所有工具权限
- 用于实际开发工作
- 可以修改文件、执行命令

#### Plan Agent
- 只读代理，用于规划和分析
- 禁用文件修改和 shell 执行
- 适合代码审查和方案设计

### 4.2 子代理 (Subagents)

#### General Agent
- 通用研究代理
- 用于复杂问题分解
- 可并行执行多个任务

#### Explore Agent
- 快速代码探索
- 只读，不修改文件
- 用于快速搜索和理解代码

### 4.3 自定义 Agent
```markdown
---
description: 代码审查专家
mode: subagent
model: anthropic/claude-sonnet-4-5
tools:
  write: false
  edit: false
---

你是一个代码审查专家，专注于：
- 代码质量和最佳实践
- 潜在的 bug 和边界情况
- 性能和安全问题
```

### 4.4 Agent 切换
- `Tab` 键切换主代理
- `@agent-name` 调用子代理
- 快捷键配置

---

## 5. 自定义命令 (Commands)

### 5.1 斜杠命令

#### 内置命令
| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清除对话 |
| `/undo` | 撤销上一轮 |
| `/redo` | 重做 |
| `/share` | 分享对话 |
| `/export` | 导出对话 |
| `/models` | 切换模型 |
| `/settings` | 打开设置 |

#### 自定义命令
```markdown
---
description: 运行测试
agent: build
---

运行测试套件并分析失败的用例，
提供修复建议。
```

### 5.2 命令参数
```
/create-component Button src/components
```

使用 `$1`, `$2` 或 `$ARGUMENTS` 获取参数。

### 5.3 Shell 输出注入
```markdown
最近的 Git 提交：
!`git log --oneline -5`

分析这些提交并总结变更。
```

---

## 6. 多提供商管理

### 6.1 支持的提供商

| 提供商 | API 类型 | 状态 |
|--------|----------|------|
| Anthropic | Native | ✅ 已支持 |
| OpenAI | Native | ✅ 已支持 |
| DeepSeek | OpenAI 兼容 | ✅ 已支持 |
| Ollama | OpenAI 兼容 | ✅ 已支持 |
| Moonshot | OpenAI 兼容 | ✅ 已支持 |
| 智谱 AI | OpenAI 兼容 | ✅ 已支持 |
| Google AI | Native | 📋 计划中 |
| Azure OpenAI | Native | 📋 计划中 |
| AWS Bedrock | Native | 📋 计划中 |

### 6.2 模型管理
- 收藏模型快速切换
- 模型性能统计
- 成本追踪

### 6.3 负载均衡
- 多 API Key 轮换
- 失败自动重试
- 备用提供商切换

---

## 7. UI/UX 增强

### 7.1 主题系统
```json
{
  "theme": "dark",
  "themes": {
    "custom": {
      "primary": "#8b5cf6",
      "background": "#0f0f1a"
    }
  }
}
```

- 内置主题：Light, Dark, System
- 自定义颜色方案
- 代码高亮主题

### 7.2 快捷键配置
```json
{
  "keybinds": {
    "send": "Enter",
    "newline": "Shift+Enter",
    "clear": "Cmd+K",
    "undo": "Cmd+Z",
    "settings": "Cmd+,"
  }
}
```

### 7.3 代码渲染增强
- Syntax highlighting (highlight.js/Prism)
- 代码块复制按钮
- 行号显示
- Diff 视图

### 7.4 Markdown 增强
- 表格渲染
- 数学公式 (KaTeX)
- Mermaid 图表
- 图片预览

### 7.5 系统托盘
- 最小化到托盘
- 全局快捷键唤醒
- 通知支持

---

## 实现优先级

### v1.3 - 会话持久化
- [ ] SQLite 存储层
- [ ] 会话列表 UI
- [ ] 会话导出

### v1.4 - 基础工具系统
- [ ] 文件读取工具
- [ ] 目录浏览工具
- [ ] 权限确认对话框

### v1.5 - MCP 支持
- [ ] MCP 客户端实现
- [ ] 本地 MCP 服务器支持
- [ ] 工具注册机制

### v1.6 - Agent 系统
- [ ] Build/Plan 双代理
- [ ] Agent 配置文件
- [ ] Agent 切换 UI

### v2.0 - 全面增强
- [ ] 主题系统
- [ ] 快捷键配置
- [ ] 代码高亮
- [ ] 系统托盘

---

## 技术参考

- [OpenCode 文档](https://opencode.ai/docs)
- [MCP 规范](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Anthropic API](https://docs.anthropic.com)

---

## 贡献指南

欢迎贡献！请参考以下流程：

1. 查看 [Issues](../../issues) 了解当前任务
2. Fork 并创建功能分支
3. 提交 PR 并描述变更
4. 等待代码审查

---

*最后更新: 2026-02-20*
