import { memo } from 'react';
import { Bot, AlertTriangle, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import type { ChatMessage, MessageItem, PermissionSuggestion } from '../../types';
import { BRANDING } from '../../shared/branding';

interface WaitingState {
  thinkingText: string;
  waitElapsedSec: number;
  showWaitDurationHint: boolean;
  shouldShowThinking: boolean;
  shouldShowContinue: boolean;
  activeWaitStage: 'approval' | 'model' | null;
}

interface MessageListProps {
  messages: ChatMessage[];
  streamItems: MessageItem[];
  isLoading: boolean;
  hasPendingApproval: boolean;
  brandIconLoadFailed: boolean;
  onBrandIconError: () => void;
  onSetInput: (input: string) => void;
  approveToolCall: (id: string, updatedPermissions?: PermissionSuggestion[]) => void;
  rejectToolCall: (id: string) => void;
  allowToolForSession: (tool: string) => void;
  onAllowAllForSession: () => void;
  waitingState: WaitingState;
}

const PROMPT_SUGGESTIONS = [
  '帮我快速分析这个项目结构',
  '生成今天的开发任务清单',
  '帮我审查一段 TypeScript 代码',
];

export const MessageList = memo(function MessageList({
  messages,
  streamItems,
  isLoading,
  hasPendingApproval,
  brandIconLoadFailed,
  onBrandIconError,
  onSetInput,
  approveToolCall,
  rejectToolCall,
  allowToolForSession,
  onAllowAllForSession,
  waitingState,
}: MessageListProps) {
  const { thinkingText, waitElapsedSec, showWaitDurationHint, shouldShowThinking, shouldShowContinue, activeWaitStage } = waitingState;

  return (
    <div className="max-w-4xl mx-auto px-6 py-7 space-y-4">
      {messages.length === 0 && streamItems.length === 0 && !isLoading && (
        <div className="text-center py-20">
          {brandIconLoadFailed ? (
            <div className="w-20 h-20 rounded-2xl border border-border/60 bg-[linear-gradient(145deg,hsl(var(--primary)/0.2),hsl(var(--cool-accent)/0.16))] flex items-center justify-center mx-auto mb-6 shadow-[0_18px_32px_hsl(var(--background)/0.58)]">
              <Sparkles className="h-10 w-10 text-[hsl(var(--foreground))]" />
            </div>
          ) : (
            <img src={BRANDING.rendererIconUrl} alt={BRANDING.productName} className="mx-auto mb-6 h-20 w-20 rounded-2xl border border-border/60 object-cover shadow-[0_18px_32px_hsl(var(--background)/0.58)]" onError={onBrandIconError} />
          )}
          <h2 className="text-2xl font-semibold mb-3 text-foreground tracking-tight">开始新对话</h2>
          <p className="text-muted-foreground text-[15px] max-w-xl mx-auto leading-7">一个面向开发效率的 AI 对话工作台。你可以直接提问，也可以从下面的快捷提示开始。</p>
          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            {PROMPT_SUGGESTIONS.map((prompt, index) => (
              <button key={index} type="button" onClick={() => onSetInput(prompt)} className="no-drag rounded-xl border border-border/60 bg-secondary/45 hover:bg-secondary/75 text-left px-3 py-2.5 text-sm text-foreground/85 transition-all duration-200">{prompt}</button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        msg.role === 'user' ? (
          <div key={`${msg.role}-${msg.timestamp ?? i}-${i}`} className="message-enter flex justify-end">
            <div className="px-4 py-3.5 rounded-2xl max-w-[82%] user-message rounded-br-md shadow-[0_12px_30px_hsl(var(--primary)/0.12)]">
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {msg.attachments.map((att) => (
                    <a key={att.id} href={att.dataUrl} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg" title={att.name}>
                      <img src={att.dataUrl} alt={att.name} className="h-24 max-w-[180px] rounded-lg object-cover ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-[1.03]" />
                    </a>
                  ))}
                </div>
              )}
              {msg.content.trim() ? <MarkdownRenderer content={msg.content} /> : (msg.attachments && msg.attachments.length > 0 && <p className="text-xs text-muted-foreground/75">[图片消息]</p>)}
            </div>
          </div>
        ) : msg.items && msg.items.length > 0 ? (
          <div key={`${msg.role}-${msg.timestamp ?? i}-${i}`} className="space-y-2">
            {msg.items.map((item, j) => (
              item.type === 'text' ? (
                <div key={`${i}-text-${j}`} className="flex justify-start message-enter">
                  <div className="px-4 py-3.5 rounded-2xl rounded-bl-md assistant-message max-w-[82%]"><MarkdownRenderer content={item.content} /></div>
                </div>
              ) : (
                <div key={`${i}-tool-${item.toolCall.id}`} className="flex justify-start message-enter">
                  <div className="w-full max-w-[85%]"><ToolCallBlock toolCall={item.toolCall} /></div>
                </div>
              )
            ))}
          </div>
        ) : (
          <div key={`${msg.role}-${msg.timestamp ?? i}-${i}`} className="message-enter flex justify-start">
            <div className="px-4 py-3.5 rounded-2xl max-w-[82%] assistant-message rounded-bl-md"><MarkdownRenderer content={msg.content} /></div>
          </div>
        )
      ))}

      {streamItems.map((item, i) => (
        item.type === 'text' ? (
          <div key={`text-${i}`} className="flex justify-start message-enter">
            <div className="px-4 py-3.5 rounded-2xl rounded-bl-md assistant-message max-w-[82%]"><MarkdownRenderer content={item.content} /></div>
          </div>
        ) : (
          <div key={`tool-${item.toolCall.id}`} className="flex justify-start message-enter">
            <div className="w-full max-w-[85%]">
              <ToolCallBlock toolCall={item.toolCall} onApprove={approveToolCall} onReject={rejectToolCall} onAllowForSession={allowToolForSession} onAllowAllForSession={onAllowAllForSession} />
            </div>
          </div>
        )
      ))}

      {hasPendingApproval && (
        <div className="flex justify-start message-enter">
          <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message border border-primary/35 bg-primary/12">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground/85">等待你确认工具调用</span>
            </div>
            {showWaitDurationHint && activeWaitStage === 'approval' && (
              <div className="mt-1 text-xs text-primary/85">已等待 {waitElapsedSec} 秒</div>
            )}
          </div>
        </div>
      )}

      {shouldShowThinking && (
        <div className="flex justify-start message-enter">
          <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bot className="h-5 w-5 text-primary animate-pulse" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground/80 thinking-text-fade">{thinkingText}</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                </div>
              </div>
            </div>
            {showWaitDurationHint && activeWaitStage === 'model' && (
              <div className="mt-1.5 text-xs text-foreground/55">当前阶段已等待 {waitElapsedSec} 秒</div>
            )}
          </div>
        </div>
      )}

      {shouldShowContinue && (
        <div className="flex justify-start message-enter">
          <div className="px-3 py-2 rounded-xl assistant-message border border-border/40">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary/80 animate-pulse" />
              <span className="text-xs text-foreground/75">{thinkingText}</span>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-primary/60 loading-dot" />
                <div className="w-1 h-1 rounded-full bg-primary/60 loading-dot" />
                <div className="w-1 h-1 rounded-full bg-primary/60 loading-dot" />
              </div>
            </div>
            {showWaitDurationHint && activeWaitStage === 'model' && (
              <div className="mt-1 text-[11px] text-foreground/50">当前阶段已等待 {waitElapsedSec} 秒</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
