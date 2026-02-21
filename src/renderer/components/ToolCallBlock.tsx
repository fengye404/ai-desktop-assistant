import { useState } from 'react';
import { ChevronRight, ChevronDown, Terminal, CheckCircle2, XCircle, Loader2, AlertTriangle, Check, X, ShieldCheck, ShieldPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import type { ToolCallRecord } from '../../types';

// Re-export for backward compatibility
export type ToolCall = ToolCallRecord;

interface ToolCallBlockProps {
  toolCall: ToolCall;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onAllowForSession?: (toolName: string) => void;  // 本次会话允许该工具
  onAllowAllForSession?: () => void;  // 本次会话允许所有工具
}

// 工具名称映射为更友好的显示
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read_file: '读取文件',
  write_file: '写入文件',
  edit_file: '编辑文件',
  list_directory: '列出目录',
  search_files: '搜索文件',
  grep_search: '内容搜索',
  run_command: '执行命令',
  web_fetch: '获取网页',
  get_system_info: '系统信息',
};

export function ToolCallBlock({ toolCall, onApprove, onReject, onAllowForSession, onAllowAllForSession }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'pending');

  const displayName = TOOL_DISPLAY_NAMES[toolCall.name] || toolCall.name;

  // 获取主要参数用于显示
  const getMainParam = () => {
    if (toolCall.input.path) return toolCall.input.path as string;
    if (toolCall.input.command) return toolCall.input.command as string;
    if (toolCall.input.url) return toolCall.input.url as string;
    if (toolCall.input.pattern) return toolCall.input.pattern as string;
    return null;
  };

  const mainParam = getMainParam();
  const isPending = toolCall.status === 'pending';

  return (
    <div className={cn(
      "my-2 rounded-lg border overflow-hidden",
      isPending 
        ? "border-yellow-500/50 bg-yellow-500/5" 
        : "border-border/50 bg-secondary/30"
    )}>
      {/* Header - 可点击展开/折叠 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
      >
        {/* 展开/折叠图标 */}
        <span className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* 工具图标 */}
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center",
          toolCall.status === 'pending' && "bg-yellow-500/20",
          toolCall.status === 'running' && "bg-blue-500/20",
          toolCall.status === 'success' && "bg-green-500/20",
          toolCall.status === 'error' && "bg-red-500/20",
        )}>
          {isPending ? (
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
          ) : (
            <Terminal className={cn(
              "h-3.5 w-3.5",
              toolCall.status === 'running' && "text-blue-400",
              toolCall.status === 'success' && "text-green-400",
              toolCall.status === 'error' && "text-red-400",
            )} />
          )}
        </div>

        {/* 工具名称和参数 */}
        <div className="flex-1 min-w-0">
          {isPending && (
            <span className="text-xs text-yellow-400 mr-2">需要确认</span>
          )}
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          {mainParam && (
            <span className="ml-2 text-xs text-muted-foreground truncate">
              <code className="bg-background/50 px-1.5 py-0.5 rounded text-primary/80">
                {mainParam.length > 40 ? mainParam.substring(0, 40) + '...' : mainParam}
              </code>
            </span>
          )}
        </div>

        {/* 状态图标 */}
        <div className="flex items-center gap-2">
          {toolCall.status === 'running' && (
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
          )}
          {toolCall.status === 'success' && (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          )}
          {toolCall.status === 'error' && (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
        </div>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-background/30">
          {/* 输入参数 */}
          <div className="px-3 py-2 border-b border-border/30">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">输入参数</div>
            <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto text-foreground/80 max-h-[200px]">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* 待确认状态 - 显示操作按钮 */}
          {isPending && (
            <div className="px-3 py-3 space-y-2">
              {/* 快捷选项 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowForSession?.(toolCall.name);
                    onApprove?.(toolCall.id);
                  }}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  本次会话允许该工具
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowAllForSession?.();
                    onApprove?.(toolCall.id);
                  }}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2"
                >
                  <ShieldPlus className="h-3.5 w-3.5" />
                  本次会话允许所有
                </Button>
              </div>
              {/* 主按钮 */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.(toolCall.id);
                  }}
                  className="gap-1.5 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove?.(toolCall.id);
                  }}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-3.5 w-3.5" />
                  允许
                </Button>
              </div>
            </div>
          )}

          {/* 输出结果 */}
          {(toolCall.output || toolCall.error) && (
            <div className="px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                {toolCall.status === 'error' ? '错误信息' : '输出结果'}
              </div>
              <pre className={cn(
                "text-xs rounded p-2 overflow-x-auto max-h-[300px]",
                toolCall.status === 'error' 
                  ? "bg-red-500/10 text-red-300" 
                  : "bg-background/50 text-foreground/80"
              )}>
                {toolCall.error || toolCall.output || '(无输出)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 渲染多个工具调用块
 */
interface ToolCallListProps {
  toolCalls: ToolCall[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onAllowForSession?: (toolName: string) => void;
  onAllowAllForSession?: () => void;
}

export function ToolCallList({ toolCalls, onApprove, onReject, onAllowForSession, onAllowAllForSession }: ToolCallListProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-1">
      {toolCalls.map((toolCall) => (
        <ToolCallBlock 
          key={toolCall.id} 
          toolCall={toolCall} 
          onApprove={onApprove}
          onReject={onReject}
          onAllowForSession={onAllowForSession}
          onAllowAllForSession={onAllowAllForSession}
        />
      ))}
    </div>
  );
}
