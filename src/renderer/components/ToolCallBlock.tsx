import { memo, useEffect, useState } from 'react';
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

export const ToolCallBlock = memo(function ToolCallBlock({
  toolCall,
  onApprove,
  onReject,
  onAllowForSession,
  onAllowAllForSession,
}: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'pending');
  const isPending = toolCall.status === 'pending';
  const isQueued = toolCall.status === 'queued';
  const isInputStreaming = toolCall.inputStreaming === true;
  const streamedInputLength = toolCall.inputText?.length ?? 0;

  // Auto-expand whenever approval is needed or input arguments are streaming.
  useEffect(() => {
    if (isPending || isInputStreaming) {
      setIsExpanded(true);
    }
  }, [isPending, isInputStreaming]);

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
  const inputDisplay = isInputStreaming
    ? (toolCall.inputText || '(参数生成中...)')
    : JSON.stringify(toolCall.input, null, 2);

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden shadow-[0_8px_24px_hsl(var(--background)/0.45)]',
      isPending
        ? 'border-primary/45 bg-primary/10'
        : isQueued
          ? 'border-border/70 bg-muted/35'
          : 'border-border/60 bg-secondary/35'
    )}>
      {/* Header - 可点击展开/折叠 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/65 transition-colors text-left'
      >
        {/* 展开/折叠图标 */}
        <span className='text-muted-foreground'>
          {isExpanded ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
        </span>

        {/* 工具图标 */}
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center border border-border/40',
          toolCall.status === 'pending' && 'bg-primary/20 border-primary/35',
          toolCall.status === 'queued' && 'bg-muted/45',
          toolCall.status === 'running' && 'bg-[hsl(var(--cool-accent)/0.18)] border-[hsl(var(--cool-accent)/0.35)]',
          toolCall.status === 'success' && 'bg-primary/18 border-primary/32',
          toolCall.status === 'error' && 'bg-destructive/20 border-destructive/35'
        )}>
          {isPending ? (
            <AlertTriangle className='h-3.5 w-3.5 text-primary' />
          ) : (
            <Terminal className={cn(
              'h-3.5 w-3.5',
              toolCall.status === 'queued' && 'text-muted-foreground',
              toolCall.status === 'running' && 'text-[hsl(var(--cool-accent))]',
              toolCall.status === 'success' && 'text-primary',
              toolCall.status === 'error' && 'text-destructive'
            )} />
          )}
        </div>

        {/* 工具名称和参数 */}
        <div className="flex-1 min-w-0">
          {isPending && (
            <span className='mr-2 text-[11px] uppercase tracking-[0.1em] text-primary/95'>Pending</span>
          )}
          {isQueued && !isPending && (
            <span className='mr-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground'>Queued</span>
          )}
          {isInputStreaming && !isPending && (
            <span className='mr-2 text-[11px] uppercase tracking-[0.1em] text-[hsl(var(--cool-accent))]'>Streaming</span>
          )}
          <span className='text-sm font-medium text-foreground'>{displayName}</span>
          {mainParam && (
            <span className='ml-2 text-xs text-muted-foreground truncate'>
              <code className='bg-background/50 px-1.5 py-0.5 rounded text-primary/80'>
                {mainParam.length > 40 ? mainParam.substring(0, 40) + '...' : mainParam}
              </code>
            </span>
          )}
          {isInputStreaming && (
            <span className='ml-2 text-[11px] text-[hsl(var(--cool-accent)/0.86)]'>
              已接收 {streamedInputLength} 字符
            </span>
          )}
        </div>

        {/* 状态图标 */}
        <div className='flex items-center gap-2'>
          {toolCall.status === 'queued' && (
            <Loader2 className='h-4 w-4 text-muted-foreground' />
          )}
          {toolCall.status === 'running' && (
            <Loader2 className='h-4 w-4 text-[hsl(var(--cool-accent))] animate-spin' />
          )}
          {toolCall.status === 'success' && (
            <CheckCircle2 className='h-4 w-4 text-primary' />
          )}
          {toolCall.status === 'error' && (
            <XCircle className='h-4 w-4 text-destructive' />
          )}
        </div>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className='border-t border-border/50 bg-background/35'>
          {/* 输入参数 */}
          <div className='px-3 py-2.5 border-b border-border/30'>
            <div className='text-xs font-medium text-muted-foreground mb-1.5'>
              输入参数
              {isInputStreaming && (
                <span className='ml-2 text-[11px] text-[hsl(var(--cool-accent)/0.9)]'>参数生成中...</span>
              )}
            </div>
            <pre className={cn(
              'text-xs bg-background/55 rounded-lg p-2 text-foreground/80 max-h-[200px] border border-border/40',
              isInputStreaming ? 'overflow-auto whitespace-pre-wrap break-all' : 'overflow-x-auto'
            )}>
              {inputDisplay}
            </pre>
          </div>

          {/* 待确认状态 - 显示操作按钮 */}
          {isPending && (
            <div className='px-3 py-3 space-y-2'>
              {/* 快捷选项 */}
              <div className='flex items-center gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowForSession?.(toolCall.name);
                    onApprove?.(toolCall.id);
                  }}
                  className='gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2 bg-secondary/40 border border-border/45 hover:bg-secondary/70'
                >
                  <ShieldCheck className='h-3.5 w-3.5' />
                  本次会话允许该工具
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowAllForSession?.();
                    onApprove?.(toolCall.id);
                  }}
                  className='gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2 bg-secondary/40 border border-border/45 hover:bg-secondary/70'
                >
                  <ShieldPlus className='h-3.5 w-3.5' />
                  本次会话允许所有
                </Button>
              </div>
              {/* 主按钮 */}
              <div className='flex items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.(toolCall.id);
                  }}
                  className='gap-1.5 text-muted-foreground'
                >
                  <X className='h-3.5 w-3.5' />
                  取消
                </Button>
                <Button
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove?.(toolCall.id);
                  }}
                  className='gap-1.5 shadow-primary/20'
                >
                  <Check className='h-3.5 w-3.5' />
                  允许
                </Button>
              </div>
            </div>
          )}

          {/* 输出结果 */}
          {(toolCall.output || toolCall.error) && (
            <div className='px-3 py-2.5'>
              <div className='text-xs font-medium text-muted-foreground mb-1.5'>
                {toolCall.status === 'error' ? '错误信息' : '输出结果'}
              </div>
              <pre className={cn(
                'text-xs rounded-lg p-2 overflow-x-auto max-h-[300px] border border-border/40',
                toolCall.status === 'error'
                  ? 'border-destructive/35 bg-destructive/12 text-destructive'
                  : 'bg-background/55 text-foreground/80'
              )}>
                {toolCall.error || toolCall.output || '(无输出)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ToolCallBlock.displayName = 'ToolCallBlock';

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
