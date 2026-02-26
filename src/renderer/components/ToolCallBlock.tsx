import { memo, useEffect, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Check,
  X,
  ShieldCheck,
  ShieldPlus,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import type { ToolCallRecord, PermissionSuggestion } from '../../types';

export type ToolCall = ToolCallRecord;

interface ToolCallBlockProps {
  toolCall: ToolCall;
  onApprove?: (id: string, updatedPermissions?: PermissionSuggestion[]) => void;
  onReject?: (id: string) => void;
  onAllowForSession?: (toolName: string) => void;
  onAllowAllForSession?: () => void;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  Read: '读取文件',
  Write: '写入文件',
  Edit: '编辑文件',
  MultiEdit: '批量编辑',
  Bash: '执行命令',
  Glob: '文件匹配',
  Grep: '内容搜索',
  WebSearch: '网页搜索',
  WebFetch: '获取网页',
  Task: '子任务',
  TaskOutput: '任务输出',
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

  useEffect(() => {
    if (isPending || isInputStreaming) {
      setIsExpanded(true);
    }
  }, [isPending, isInputStreaming]);

  const displayName = TOOL_DISPLAY_NAMES[toolCall.name] || toolCall.name;

  const getMainParam = () => {
    if (toolCall.input.file_path) return toolCall.input.file_path as string;
    if (toolCall.input.path) return toolCall.input.path as string;
    if (toolCall.input.command) return toolCall.input.command as string;
    if (toolCall.input.url) return toolCall.input.url as string;
    if (toolCall.input.pattern) return toolCall.input.pattern as string;
    if (toolCall.input.description) return toolCall.input.description as string;
    return null;
  };

  const mainParam = getMainParam();
  const hasRealInput = Object.keys(toolCall.input).length > 0;
  const inputDisplay = isInputStreaming
    ? (toolCall.inputText || '(参数生成中...)')
    : hasRealInput
      ? JSON.stringify(toolCall.input, null, 2)
      : (toolCall.inputText || '(等待参数...)');

  const hasSuggestions = (toolCall.suggestions?.length ?? 0) > 0;

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden shadow-[0_8px_24px_hsl(var(--background)/0.45)]',
      isPending
        ? 'border-amber-500/50 bg-amber-500/8 dark:border-amber-400/40 dark:bg-amber-400/6'
        : isQueued
          ? 'border-border/70 bg-muted/35'
          : 'border-border/60 bg-secondary/35'
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/65 transition-colors text-left'
      >
        <span className='text-muted-foreground'>
          {isExpanded ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
        </span>

        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center border border-border/40',
          toolCall.status === 'pending' && 'bg-amber-500/20 border-amber-500/35',
          toolCall.status === 'queued' && 'bg-muted/45',
          toolCall.status === 'running' && 'bg-[hsl(var(--cool-accent)/0.18)] border-[hsl(var(--cool-accent)/0.35)]',
          toolCall.status === 'success' && 'bg-primary/18 border-primary/32',
          toolCall.status === 'error' && 'bg-destructive/20 border-destructive/35'
        )}>
          {isPending ? (
            <AlertTriangle className='h-3.5 w-3.5 text-amber-500 dark:text-amber-400' />
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

        <div className="flex-1 min-w-0">
          {isPending && (
            <span className='mr-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400'>需要确认</span>
          )}
          {isQueued && !isPending && (
            <span className='mr-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground'>排队中</span>
          )}
          {isInputStreaming && !isPending && (
            <span className='mr-2 text-[11px] uppercase tracking-[0.1em] text-[hsl(var(--cool-accent))]'>生成中</span>
          )}
          <span className='text-sm font-medium text-foreground'>{displayName}</span>
          {mainParam && (
            <span className='ml-2 text-xs text-muted-foreground truncate'>
              <code className='bg-background/50 px-1.5 py-0.5 rounded text-primary/80'>
                {mainParam.length > 50 ? mainParam.substring(0, 50) + '...' : mainParam}
              </code>
            </span>
          )}
          {isInputStreaming && (
            <span className='ml-2 text-[11px] text-[hsl(var(--cool-accent)/0.86)]'>
              已接收 {streamedInputLength} 字符
            </span>
          )}
        </div>

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

      {/* Expanded Content */}
      {isExpanded && (
        <div className='border-t border-border/50 bg-background/35'>
          {/* Decision Reason */}
          {isPending && toolCall.decisionReason && (
            <div className='px-3 py-2 border-b border-border/30 bg-amber-500/5 dark:bg-amber-400/4'>
              <div className='flex items-start gap-2'>
                <Info className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0' />
                <p className='text-xs text-amber-700 dark:text-amber-300/90'>
                  {toolCall.decisionReason}
                </p>
              </div>
              {toolCall.blockedPath && (
                <div className='mt-1.5 ml-5.5'>
                  <code className='text-xs bg-amber-500/10 dark:bg-amber-400/10 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300/80 border border-amber-500/20'>
                    {toolCall.blockedPath}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Input Parameters */}
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

          {/* Pending Approval Actions */}
          {isPending && (
            <div className='px-3 py-3 space-y-2.5'>
              {/* Quick Actions */}
              <div className='flex items-center gap-2 flex-wrap'>
                {hasSuggestions && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove?.(toolCall.id, toolCall.suggestions);
                    }}
                    className='gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 h-7 px-2.5 bg-amber-500/8 border border-amber-500/25 hover:bg-amber-500/15 dark:bg-amber-400/8 dark:border-amber-400/20 dark:hover:bg-amber-400/15'
                  >
                    <ShieldCheck className='h-3.5 w-3.5' />
                    永久允许该操作
                  </Button>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowForSession?.(toolCall.name);
                    onApprove?.(toolCall.id);
                  }}
                  className='gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2.5 bg-secondary/40 border border-border/45 hover:bg-secondary/70'
                >
                  <ShieldCheck className='h-3.5 w-3.5' />
                  本次会话允许
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowAllForSession?.();
                    onApprove?.(toolCall.id);
                  }}
                  className='gap-1.5 text-xs text-muted-foreground hover:text-primary h-7 px-2.5 bg-secondary/40 border border-border/45 hover:bg-secondary/70'
                >
                  <ShieldPlus className='h-3.5 w-3.5' />
                  全部允许
                </Button>
              </div>

              {/* Primary Actions */}
              <div className='flex items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.(toolCall.id);
                  }}
                  className='gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40'
                >
                  <X className='h-3.5 w-3.5' />
                  拒绝
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

          {/* Output */}
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

interface ToolCallListProps {
  toolCalls: ToolCall[];
  onApprove?: (id: string, updatedPermissions?: PermissionSuggestion[]) => void;
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
