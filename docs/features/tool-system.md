# 工具系统

> Agent SDK 迁移后的架构 — 工具由 SDK 内置管理

## 架构概览

工具系统由 Claude Agent SDK 驱动，应用通过 SDK 配置启用工具集，通过 `canUseTool` 回调实现权限审批。

```
用户消息 → AgentService.sendMessageStream()
    → SDK query({ tools: { type: 'preset', preset: 'claude_code' } })
    → SDK 自动执行 Agentic Loop
        → 需要工具时：SDK 调用 canUseTool 回调
        → ToolApprovalCoordinator → IPC → 渲染层 ToolCallBlock
        → 用户确认 → SDK 继续执行工具 → 返回结果 → 下一轮
    → SDK Messages → mapSdkMessageToChunks → StreamChunk
    → 渲染层显示
```

## 工具集

使用 SDK 的 `claude_code` 预设工具集，包含文件操作、搜索、命令执行等能力。工具的定义、执行和结果处理全部由 SDK 内部管理。

## 权限审批流程

### 审批桥接

SDK 的 `canUseTool` 回调在主进程执行，需要获取渲染层用户的审批决策：

```
SDK canUseTool(toolName, input, options)
    ↓
AgentService.canUseToolCallback
    ↓
ToolApprovalCoordinator.requestApproval()
    ├── 创建 Promise + 超时定时器
    └── IPC 推送 tool-approval-request → 渲染层
        ↓
chat-stream-listener → chat-store (pendingApprovalId)
    ↓
ToolCallBlock 渲染审批按钮（允许/拒绝 + 权限建议）
    ↓
用户操作 → electronApiClient.respondToolApproval()
    ↓
IPC: tool-approval-response → ToolApprovalCoordinator.respond()
    ↓
Promise resolve → SDK 获得 PermissionResult
```

### 审批选项

审批响应可以包含 `updatedPermissions`（权限建议），SDK 会永久记住该规则：

```typescript
interface ToolApprovalResponse {
  approved: boolean;
  updatedPermissions?: PermissionSuggestion[];
}
```

### 超时机制

- 默认超时由 `ToolApprovalCoordinator` 管理
- 超时后自动拒绝执行
- 防止 SDK 查询无限等待

## 工具调用 UI

### ToolCallBlock 组件

工具调用以可折叠卡片形式穿插显示在对话流中，由 `ToolCallBlock.tsx` 渲染：

- **状态指示**：pending (黄色) / running (蓝色) / success (绿色) / error (红色)
- **内联审批**：需要确认时直接在卡片内显示允许/拒绝按钮
- **输入参数**：流式显示工具输入（通过 `tool_input_delta` chunk）
- **执行结果**：工具完成后显示输出

### 流式工具调用处理

SDK Message 到 StreamChunk 的映射：

| SDK 事件 | StreamChunk 类型 | 说明 |
|---------|-----------------|------|
| `content_block_start` (tool_use) | `tool_use` (complete=false) | 工具调用开始 |
| `content_block_delta` (input_json_delta) | `tool_input_delta` | 输入参数逐步到达 |
| `content_block_stop` | `tool_use` (complete=true) | 工具输入完成 |
| `tool_progress` | `tool_start` | 工具开始执行 |
| User message (tool_result) | `tool_result` | 工具执行结果 |

## 核心代码

| 文件 | 职责 |
|------|------|
| `src/agent-service.ts` | SDK 交互，canUseTool 回调注册，消息映射 |
| `src/main-process/tool-approval-coordinator.ts` | 审批异步桥接 |
| `src/main-process/ipc/tool-approval-handlers.ts` | 审批 IPC |
| `src/renderer/components/ToolCallBlock.tsx` | 工具调用卡片 + 内联审批 UI |
| `src/renderer/stores/chat-store.ts` | 流式状态管理，审批操作 |
| `src/renderer/stores/chat-stream-state.ts` | 工具相关 chunk 的纯 reducer |

## MCP 工具扩展

除 SDK 内置工具外，支持通过 MCP 协议动态扩展工具：

```typescript
// AgentService 配置 MCP 服务器
sdkOptions.mcpServers = this.mcpServersConfig;

// MCP 支持三种传输方式
type McpServerTransport = 'stdio' | 'streamable-http' | 'sse';
```

MCP 工具的审批流程与内置工具一致，经由 `canUseTool` 统一管理。
