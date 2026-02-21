# 工具系统

> v1.4.0 新增 - 参考 [Claude Agent SDK](https://platform.claude.com/docs/zh-CN/agent-sdk/overview) 设计

工具系统是 AI Desktop Assistant 的核心能力，让 AI 能够执行文件操作、搜索、命令执行等实际任务。

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      Agentic Loop 调用流程                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   用户输入 ──> Claude API ──> 解析响应 ──> 有工具调用?        │
│                                              │               │
│                              ┌───────────────┴────────────┐  │
│                              ↓                            ↓  │
│                        ┌──────────┐               ┌─────────┐│
│                        │ 权限检查  │               │ 输出文本 ││
│                        │ ask/allow│               └─────────┘│
│                        └──────────┘                          │
│                              │                               │
│               ┌──────────────┴──────────────┐               │
│               ↓                             ↓               │
│        ┌────────────┐               ┌────────────┐          │
│        │ allow: 直接 │               │ ask: 弹窗  │          │
│        │ 执行工具    │               │ 请求用户批准│          │
│        └────────────┘               └────────────┘          │
│               │                             │               │
│               └──────────────┬──────────────┘               │
│                              ↓                              │
│                   ┌─────────────────────┐                   │
│                   │ ToolExecutor 执行    │                   │
│                   └─────────────────────┘                   │
│                              │                              │
│                              ↓                              │
│                   ┌─────────────────────┐                   │
│                   │ 结果返回 Claude API  │                   │
│                   │ 继续下一轮对话       │                   │
│                   └─────────────────────┘                   │
│                              │                              │
│                              ↓                              │
│                     循环继续 (最多 10 次)                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 内置工具

| 工具 | 功能 | 权限 |
|------|------|------|
| `read_file` | 读取文件内容，支持指定行范围 | allow |
| `write_file` | 创建或覆盖文件 | ask |
| `edit_file` | 精确字符串替换编辑 | ask |
| `list_directory` | 列出目录内容 | allow |
| `search_files` | Glob 模式搜索文件路径 | allow |
| `grep_search` | 正则表达式搜索文件内容 | allow |
| `run_command` | 执行 Shell 命令 | ask |
| `web_fetch` | 获取网页内容 | allow |
| `get_system_info` | 获取系统信息 | allow |

## 权限系统

三级权限控制：

| 权限 | 说明 | 用户交互 |
|------|------|----------|
| `allow` | 自动允许 | 无 |
| `ask` | 需要确认 | 弹窗审批 |
| `deny` | 禁止使用 | 拒绝执行 |

敏感操作（写文件、执行命令）默认需要用户确认，通过 `ToolApprovalDialog` 组件展示。

## 核心代码

| 文件 | 职责 |
|------|------|
| `src/tool-executor.ts` | 工具定义和执行实现 |
| `src/claude-service.ts` | Agentic Loop 主逻辑 |
| `src/renderer/components/ToolApprovalDialog.tsx` | 权限审批弹窗 |

## 工具定义格式

遵循 Anthropic Tool Use 规范：

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  permission: 'allow' | 'ask' | 'deny';
}
```

## 调用流程详解

### 1. 注册工具到 Claude API

```typescript
// claude-service.ts
const tools = this.toolExecutor.getToolDefinitions();
const stream = client.messages.stream({
  model: this.config.model,
  messages,
  tools,  // 告诉 Claude 可用工具
});
```

### 2. 解析 AI 的工具调用请求

Claude 返回的响应中包含 `tool_use` 类型的内容块：

```typescript
if (event.content_block.type === 'tool_use') {
  currentToolName = event.content_block.name;  // 如 "edit_file"
  currentToolInput = ...;  // 参数 JSON
}
```

### 3. 执行工具

```typescript
const result = await this.toolExecutor.executeTool(toolUse.name, toolUse.input);
```

### 4. 返回结果给 Claude

```typescript
toolResults.push({
  type: 'tool_result',
  tool_use_id: toolUse.id,
  content: result.output,
  is_error: !result.success,
});
messages.push({ role: 'user', content: toolResults });
// 继续下一轮对话
```

## 配置项

```typescript
// claude-service.ts
const MAX_TOOL_ITERATIONS = 10;  // 最大工具调用循环次数
```

## 相关文档

- [Claude Agent SDK 官方文档](https://platform.claude.com/docs/zh-CN/agent-sdk/overview)
- [产品路线图 - 工具系统](../roadmap.md#阶段一-工具系统-v14----已完成)
