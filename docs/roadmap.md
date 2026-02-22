# 产品路线图

> AI Desktop Assistant 未来发展方向与功能规划
> 参考: Claude Agent SDK / Claude Code

## 产品定位

**AI Desktop Assistant** 定位为一款类似 **Anthropic Claude Cowork** 的桌面 AI 协作工具，提供：

- 流畅的多轮对话体验
- 本地文件与项目的深度集成
- 工具调用和自动化能力
- MCP 协议支持，连接外部服务
- 多 AI 提供商支持

## 当前已实现 vs Claude Agent SDK

| 功能 | 当前状态 | Claude Agent SDK |
|------|----------|------------------|
| 多轮对话 | ✅ 已实现 | ✅ |
| 流式响应 | ✅ 已实现 | ✅ |
| 会话持久化 | ✅ SQLite | ✅ |
| 配置持久化 | ✅ SQLite | ✅ |
| 多 API 提供商 | ✅ 已实现 | ✅ |
| 文件读取工具 | ✅ 已实现 | ✅ |
| 文件写入工具 | ✅ 已实现 | ✅ |
| 文件编辑工具 | ✅ 已实现 | ✅ |
| Bash 执行工具 | ✅ 已实现 | ✅ |
| Glob 搜索 | ✅ 已实现 | ✅ |
| Grep 搜索 | ✅ 已实现 | ✅ |
| WebFetch | ✅ 已实现 | ✅ |
| 工具权限系统 | ✅ 已实现 | ✅ |
| 工具循环 (Agentic Loop) | ✅ 已实现 | ✅ |
| Git 集成 | ❌ | ✅ |
| MCP 协议 | ✅ 已实现 | ✅ |
| Hooks 系统 | ❌ | ✅ |
| 子代理 (Subagents) | ❌ | ✅ (最多 7 个并行) |
| 检查点/恢复 | ❌ | ✅ |
| 上下文压缩 | ✅ 基础版 | ✅ |
| @ 文件引用 | ✅ 基础版 | ✅ |
| 斜杠命令 | ✅ 基础版 | ✅ |
| IDE 集成 | ❌ | ✅ VS Code |

---

## 功能模块详细规划

### 阶段一: 工具系统 (v1.4) - ✅ 已完成

#### 1.1 内置工具

| 工具 | 功能 | 权限 | 优先级 | 状态 |
|------|------|------|--------|------|
| `Read` | 读取文件内容，支持行号范围 | allow | P0 | ✅ 已实现 |
| `Write` | 创建或覆盖整个文件 | ask | P0 | ✅ 已实现 |
| `Edit` | 精确字符串替换编辑 | ask | P0 | ✅ 已实现 |
| `Glob` | 按模式搜索文件 (如 `**/*.ts`) | allow | P0 | ✅ 已实现 |
| `Grep` | 正则表达式搜索文件内容 | allow | P0 | ✅ 已实现 |
| `Bash` | 执行 Shell 命令 | ask | P0 | ✅ 已实现 |
| `WebFetch` | 获取网页内容 | allow | P1 | ✅ 已实现 |
| `WebSearch` | 网络搜索 | allow | P2 | ❌ 待开发 |
| `ListDir` | 列出目录内容 | allow | - | ✅ 已实现 (额外) |
| `SystemInfo` | 获取系统信息 | allow | - | ✅ 已实现 (额外) |

#### 1.2 工具实现架构

```typescript
interface Tool {
  name: string;
  description: string;
  input_schema: JSONSchema;
  execute: (input: unknown) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}
```

#### 1.3 权限系统 - ✅ 已实现

```json
{
  "permissions": {
    "read": "allow",
    "write": "ask",
    "edit": "ask",
    "bash": "ask",
    "webfetch": "allow"
  },
  "allowedPaths": ["./src", "./docs"],
  "deniedPaths": ["./node_modules", "./.env"]
}
```

权限级别：
- `allow` - 自动允许，无需确认
- `ask` - 每次询问用户确认
- `deny` - 禁止使用

#### 1.4 工具循环 (Agentic Loop) - ✅ 已实现

```
用户输入
    ↓
AI 分析并选择工具
    ↓
执行工具 → 返回结果
    ↓
AI 继续分析（可能再次调用工具）
    ↓
最终响应
```

---

### 阶段二: 检查点与恢复 (v1.4.5)

#### 2.1 检查点系统

Claude Code 的检查点功能可以追踪所有文件修改，允许用户随时回滚。

```typescript
interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  changes: FileChange[];
}

interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  before?: string;
  after?: string;
}
```

#### 2.2 恢复功能

- `/rewind` - 打开恢复菜单
- `Esc + Esc` - 快捷键打开恢复菜单
- 可选择恢复代码、对话或两者

**注意**: Bash 命令执行的修改不会被追踪，只有通过工具的文件编辑会被记录。

---

### 阶段三: @ 文件引用 (v1.5)

#### 3.1 基础引用

```
> 分析 @src/auth.ts 并建议改进

> 比较 @package.json 和 @package-lock.json

> 解释 @src/components/ 目录的架构
```

#### 3.2 行范围引用

```
> 修复 @src/utils.ts:42-58 中的 bug
```

#### 3.3 自动补全

按 `Tab` 键自动补全文件路径和命令。

---

### 阶段四: 斜杠命令 (v1.5)

#### 4.1 内置命令

| 命令 | 功能 | 状态 |
|------|------|------|
| `/help` | 显示所有可用命令 | ✅ 已实现（基础版） |
| `/init` | 扫描项目并创建 CLAUDE.md | 📋 计划 |
| `/clear` | 清除对话历史 | ✅ 已实现 |
| `/compact` | 压缩对话以节省上下文 | ✅ 已实现 |
| `/memory` | 编辑项目记忆文件 | 📋 计划 |
| `/config` | 打开配置界面 | ✅ 已实现 |
| `/model` | 切换模型 | ✅ 已实现 |
| `/cost` | 查看当前 token 用量 | 📋 计划 |
| `/mcp` | 管理 MCP 服务器 | 📋 计划 |
| `/rewind` | 回滚到之前的检查点 | 📋 计划 |
| `/export` | 导出对话到文件 | 📋 计划 |

#### 4.2 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 停止当前响应 |
| `Escape + Escape` | 打开恢复菜单 |
| `↑` (上箭头) | 浏览历史消息 |
| `Ctrl + V` | 粘贴图片 |
| `Tab` | 自动补全 |

---

### 阶段五: Git 集成 (v1.6)

#### 5.1 Git 操作支持

| 操作 | 功能 |
|------|------|
| 状态查看 | `git status`, `git diff` |
| 提交 | 生成提交消息并提交 |
| 分支 | 创建、切换、合并分支 |
| Pull Request | 创建 PR 并生成描述 |
| 代码审查 | 分析变更并提供建议 |

#### 5.2 智能提交

AI 自动分析变更并生成有意义的提交消息：

```
> 提交当前更改

AI: 分析变更...
建议提交消息: "feat(auth): add OAuth2 login support"
确认提交？[Y/n]
```

---

### 阶段六: Hooks 系统 (v1.7)

#### 6.1 生命周期事件

Hooks 允许在 AI 操作的各个阶段执行自定义逻辑：

| 事件 | 触发时机 |
|------|----------|
| `SessionStart` | 会话开始 |
| `UserPromptSubmit` | 用户提交消息后 |
| `PreToolUse` | 工具执行前 |
| `PostToolUse` | 工具执行后 |
| `PreFileEdit` | 文件编辑前 |
| `PostFileEdit` | 文件编辑后 |
| `PreBashExecute` | Bash 命令执行前 |
| `PostBashExecute` | Bash 命令执行后 |

#### 6.2 Hook 配置

```json
{
  "hooks": {
    "PostFileEdit": {
      "command": "npx prettier --write $FILE",
      "description": "自动格式化编辑后的文件"
    },
    "PreBashExecute": {
      "command": "echo $COMMAND | grep -v 'rm -rf'",
      "description": "阻止危险命令"
    }
  }
}
```

#### 6.3 用例

- **自动格式化**: 文件编辑后自动运行 Prettier/ESLint
- **命令安全**: 阻止危险的 Bash 命令执行
- **日志记录**: 记录所有工具调用
- **通知**: 长时间任务完成后发送通知

---

### 阶段八: 沙箱执行环境 (v1.8)

#### 8.1 双执行模式

任务执行支持两种模式，用户可根据安全需求选择：

| 模式 | 隔离级别 | 性能 | 适用场景 |
|------|----------|------|----------|
| **本地模式** | 无隔离 | ⚡ 最快 | 信任的项目、日常开发 |
| **沙箱模式** | VM 隔离 | 🐢 较慢 | 不信任的代码、敏感操作 |

#### 8.2 沙箱技术方案

```
┌─────────────────────────────────────────────────────────────┐
│                    Host (macOS/Windows)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Electron Main Process                   │    │
│  │  ┌─────────────┐     ┌────────────────────────┐     │    │
│  │  │ Local Mode  │     │      Sandbox Mode       │     │    │
│  │  │ (直接执行)   │     │  ┌──────────────────┐  │     │    │
│  │  │             │     │  │  QEMU + Alpine   │  │     │    │
│  │  │ - Bash      │     │  │  ───────────────  │  │     │    │
│  │  │ - File R/W  │     │  │  - SSH Server    │  │     │    │
│  │  │ - Git       │     │  │  - Shared /work  │  │     │    │
│  │  │             │     │  │  - Node/Python   │  │     │    │
│  │  └─────────────┘     │  └──────────────────┘  │     │    │
│  │                      └────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**核心组件：**

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 虚拟化 | QEMU | 跨平台，支持 macOS (HVF) / Windows (WHPX) |
| 客户机 OS | Alpine Linux | 轻量 (~50MB)，启动快 (~3s) |
| 通信 | SSH + virtio-serial | SSH 执行命令，串口传输大文件 |
| 文件共享 | 9p virtio-fs | Host-Guest 共享目录 |
| 快照 | QEMU snapshot | 快速恢复到干净状态 |

#### 8.3 Alpine Linux 镜像配置

预装开发环境：

```dockerfile
# 基础系统 (~50MB)
apk add openssh bash curl git

# 开发工具链
apk add nodejs npm python3 py3-pip
apk add build-base gcc g++ make

# 常用工具
apk add jq ripgrep fd tree

# SSH 配置
rc-update add sshd
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
```

#### 8.4 执行流程

**本地模式：**
```
用户请求 → AI 调用 Bash 工具 → 直接执行 → 返回结果
```

**沙箱模式：**
```
用户请求 → AI 调用 Bash 工具
    ↓
检查 VM 状态（未运行则启动）
    ↓
同步工作目录到 VM (/work)
    ↓
SSH 执行命令
    ↓
同步结果回 Host
    ↓
返回结果
```

#### 8.5 配置接口

```typescript
interface SandboxConfig {
  // 执行模式
  mode: 'local' | 'sandbox';
  
  // VM 资源配置
  vm: {
    cpus: number;       // CPU 核心数 (默认: 2)
    memory: string;     // 内存大小 (默认: '2G')
    diskSize: string;   // 磁盘大小 (默认: '10G')
  };
  
  // 网络配置
  network: {
    enabled: boolean;   // 是否允许网络访问
    allowedHosts: string[];  // 白名单域名
  };
  
  // 自动恢复
  autoReset: boolean;   // 每次任务后重置 VM
}
```

#### 8.6 UI 配置界面

设置面板新增：

```
┌─────────────────────────────────────┐
│  执行环境                            │
├─────────────────────────────────────┤
│  ○ 本地模式 (直接执行，无隔离)        │
│  ● 沙箱模式 (VM 隔离，更安全)        │
│                                     │
│  ─────── 沙箱配置 ───────            │
│  CPU: [2 ▼] 核心                    │
│  内存: [2 ▼] GB                     │
│  [ ] 允许网络访问                    │
│  [✓] 任务完成后自动重置              │
│                                     │
│  [启动沙箱]  [重置沙箱]              │
└─────────────────────────────────────┘
```

#### 8.7 安全边界

| 威胁 | 本地模式 | 沙箱模式 |
|------|----------|----------|
| 恶意脚本删除文件 | ❌ 有风险 | ✅ 隔离在 VM |
| 窃取敏感数据 | ❌ 有风险 | ✅ 无法访问 Host |
| 网络攻击 | ❌ 有风险 | ✅ 可禁用网络 |
| 挖矿/DDoS | ❌ 有风险 | ✅ 资源受限 |
| 持久化后门 | ❌ 有风险 | ✅ 可重置 |

#### 8.8 性能优化

- **懒加载**: 仅在首次使用沙箱模式时下载镜像
- **快照启动**: 使用 QEMU 快照实现 <3s 启动
- **增量同步**: 仅同步变更的文件
- **Keep-alive**: VM 保持运行避免重启开销
- **并行执行**: 多个命令可在同一 VM 中并行

#### 8.9 实现步骤

1. **Phase 1**: QEMU 集成
   - 检测并安装 QEMU
   - 下载预构建 Alpine 镜像
   - 实现 VM 启动/停止/快照

2. **Phase 2**: 命令执行
   - SSH 客户端集成
   - 命令执行和输出流
   - 超时和错误处理

3. **Phase 3**: 文件同步
   - 9p virtio-fs 挂载
   - 双向文件同步
   - 大文件优化

4. **Phase 4**: UI 集成
   - 设置面板
   - 状态指示器
   - 一键切换

---

### 阶段九: MCP 协议支持 (v1.9)

#### 9.1 MCP 概述

Model Context Protocol (MCP) 是 Anthropic 提出的开放协议，允许 AI 应用连接外部工具和数据源。

#### 9.2 传输类型

| 类型 | 用途 | 示例 |
|------|------|------|
| HTTP | 远程服务器（推荐） | Notion, GitHub, Sentry |
| Stdio | 本地进程 | PostgreSQL, 文件系统 |

#### 9.3 常用 MCP 服务器

| 服务器 | 功能 | 安装命令 |
|--------|------|----------|
| filesystem | 文件系统访问 | `npx @anthropic/mcp-server-filesystem` |
| github | GitHub 集成 | `npx @anthropic/mcp-server-github` |
| postgres | 数据库查询 | `npx @anthropic/mcp-server-postgres` |
| slack | Slack 消息 | `npx @anthropic/mcp-server-slack` |
| notion | Notion 文档 | HTTP: `https://mcp.notion.com/mcp` |
| brave-search | 网络搜索 | `npx @modelcontextprotocol/server-brave-search` |

#### 9.4 配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "./"]
    },
    "github": {
      "transport": "http",
      "url": "https://mcp.github.com",
      "oauth": {
        "clientId": "xxx",
        "scope": "repo"
      }
    }
  }
}
```

---

### 阶段十: Agent 系统 (v2.0)

#### 10.1 主代理模式

| 模式 | 权限 | 用途 |
|------|------|------|
| Build | 完整权限 | 开发、修改文件、执行命令 |
| Plan | 只读 | 规划、分析、代码审查 |

按 `Tab` 键切换主代理模式。

#### 10.2 子代理 (Subagents)

Claude Code 支持最多 **7 个并行子代理**：

| 代理 | 功能 | 权限 |
|------|------|------|
| General | 通用研究，复杂问题分解 | 完整 |
| Explore | 快速代码探索 | 只读 |
| Custom | 用户自定义代理 | 可配置 |

使用 `@agent-name` 调用子代理：

```
> @explore 找出所有使用 useState 的组件
```

#### 10.3 自定义 Agent

```markdown
---
name: code-reviewer
description: 代码审查专家
mode: subagent
model: claude-sonnet-4-5
tools:
  write: false
  edit: false
  bash: false
---

你是一个代码审查专家，专注于：
- 代码质量和最佳实践
- 潜在的 bug 和边界情况
- 性能和安全问题
```

---

### 阶段十一: 上下文管理 (v2.1)

#### 11.1 上下文压缩 (/compact)

当对话过长时，自动压缩保留关键信息：

```
> /compact

AI: 压缩对话历史...
- 原始: 150,000 tokens
- 压缩后: 45,000 tokens
- 保留了关键决策和代码变更记录
```

#### 11.2 项目记忆 (CLAUDE.md)

```markdown
# Project: AI Desktop Assistant

## Tech Stack
- Electron 28
- TypeScript 5.3
- SQLite (better-sqlite3)

## Coding Conventions
- 使用英文注释
- 遵循 ESLint 规则

## Important Files
- src/claude-service.ts - AI 服务核心
- src/session-storage.ts - 会话存储
```

#### 11.3 200K 上下文窗口

Claude 支持 200K token 的上下文窗口，可以理解整个代码库结构。

---

### 阶段十二: IDE 集成 (v2.2)

#### 12.1 VS Code 扩展

- 侧边栏聊天界面
- @ 引用打开的文件
- 选中代码直接询问
- 内联代码建议

#### 12.2 GitHub 集成

- `@claude` 在 PR 中触发审查
- 自动生成 PR 描述
- Issue 分析和建议

---

## 实现优先级总结

| 版本 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| v1.4 | 工具系统 (Read/Write/Edit/Bash/Grep/WebFetch) | P0 | ✅ 已完成 |
| v1.4.5 | 检查点与恢复 | P0 | ❌ 未开始 |
| v1.5 | @ 文件引用 + 斜杠命令 | P0 | ✅ 基础能力已完成 |
| v1.6 | Git 集成 | P1 | ❌ 未开始 |
| v1.7 | Hooks 系统 | P1 | ❌ 未开始 |
| v1.8 | **沙箱执行环境 (QEMU + Alpine)** | P1 | ❌ 未开始 |
| v1.9 | MCP 协议支持 | P1 | ✅ 已完成 |
| v2.0 | Agent 系统 | P2 | ❌ 未开始 |
| v2.1 | 上下文管理 | P2 | 🟡 部分完成（/compact） |
| v2.2 | IDE 集成 | P3 | ❌ 未开始 |

---

## 技术参考

### Claude Agent SDK 官方文档

| 文档 | 链接 |
|------|------|
| SDK 概览 | https://platform.claude.com/docs/zh-CN/agent-sdk/overview |
| 快速开始 | https://platform.claude.com/docs/zh-CN/agent-sdk/quickstart |
| TypeScript SDK | https://platform.claude.com/docs/zh-CN/agent-sdk/typescript |
| Python SDK | https://platform.claude.com/docs/zh-CN/agent-sdk/python |

> **Note**: 如果中文文档无法访问，可将 URL 中的 `zh-CN` 替换为 `en` 使用英文文档。

### 其他参考

- [MCP 规范](https://modelcontextprotocol.io)
- [Anthropic API](https://docs.anthropic.com)

---

*最后更新: 2026-02-22*
