import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Trash2, Settings, Sparkles, Bot, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useConfigStore } from '@/stores/config-store';

const THINKING_MESSAGES = [
  '思考中',
  '正在分析',
  '组织思路',
  '准备回答',
];

const TOOL_PROCESSING_MESSAGES = [
  '处理中',
  '执行操作',
  '等待结果',
  '继续处理',
];
const CONTINUE_MESSAGES = [
  '继续生成中',
  '整理后续内容',
  '正在补全答案',
];
const WAIT_TIME_HINT_THRESHOLD_SEC = 8;

type WaitStage = 'approval' | 'model' | null;

// 检查是否有文本内容输出
const hasTextContent = (items: { type: string }[]) => {
  return items.some(item => item.type === 'text');
};

const hasPendingToolApproval = (items: Array<{ type: string; toolCall?: { status?: string } }>) => {
  return items.some(item => item.type === 'tool' && item.toolCall?.status === 'pending');
};

export function ChatArea() {
  const currentMessages = useSessionStore((s) => s.currentMessages);

  const isLoading = useChatStore((s) => s.isLoading);
  const streamItems = useChatStore((s) => s.streamItems);
  const pendingApprovalId = useChatStore((s) => s.pendingApprovalId);
  const isWaitingResponse = useChatStore((s) => s.isWaitingResponse);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const clearHistory = useChatStore((s) => s.clearHistory);
  const initStreamListener = useChatStore((s) => s.initStreamListener);
  const approveToolCall = useChatStore((s) => s.approveToolCall);
  const rejectToolCall = useChatStore((s) => s.rejectToolCall);

  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const apiKey = useConfigStore((s) => s.apiKey);
  const allowToolForSession = useConfigStore((s) => s.allowToolForSession);
  const setAllowAllForSession = useConfigStore((s) => s.setAllowAllForSession);
  const [input, setInput] = useState('');
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const [waitElapsedSec, setWaitElapsedSec] = useState(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listenerInitialized = useRef(false);
  const waitStartTimestampRef = useRef<number | null>(null);
  const hasPendingApproval = pendingApprovalId !== null || hasPendingToolApproval(streamItems);
  const hasStreamText = hasTextContent(streamItems);
  const shouldShowThinking = !hasPendingApproval && ((isLoading && !hasStreamText) || isWaitingResponse);
  const shouldShowContinue = !hasPendingApproval && isLoading && hasStreamText && !isWaitingResponse;
  const activeWaitStage: WaitStage = hasPendingApproval ? 'approval' : ((shouldShowThinking || shouldShowContinue) ? 'model' : null);
  const showWaitDurationHint = waitElapsedSec >= WAIT_TIME_HINT_THRESHOLD_SEC;

  const scrollToBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'auto',
    });
  }, []);

  // 只初始化一次流式监听器
  useEffect(() => {
    if (!listenerInitialized.current) {
      try {
        initStreamListener();
        listenerInitialized.current = true;
      } catch (error) {
        console.error('[chat-area] Failed to initialize stream listener:', error);
      }
    }
  }, [initStreamListener]);

  // 动态切换思考文字，带淡入淡出效果
  useEffect(() => {
    if (shouldShowThinking || shouldShowContinue) {
      const messages = isWaitingResponse
        ? TOOL_PROCESSING_MESSAGES
        : hasStreamText
          ? CONTINUE_MESSAGES
          : THINKING_MESSAGES;
      const interval = setInterval(() => {
        setThinkingText(prev => {
          const currentIndex = messages.indexOf(prev);
          // 如果当前文字不在当前消息列表中，从第一个开始
          if (currentIndex === -1) {
            return messages[0];
          }
          const nextIndex = (currentIndex + 1) % messages.length;
          return messages[nextIndex];
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [shouldShowThinking, shouldShowContinue, hasStreamText, isWaitingResponse]);

  useEffect(() => {
    if (!activeWaitStage) {
      waitStartTimestampRef.current = null;
      setWaitElapsedSec(0);
      return;
    }

    waitStartTimestampRef.current = Date.now();
    setWaitElapsedSec(0);

    const timer = setInterval(() => {
      if (!waitStartTimestampRef.current) return;
      const elapsedMs = Date.now() - waitStartTimestampRef.current;
      setWaitElapsedSec(Math.floor(elapsedMs / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWaitStage]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentMessages, streamItems, scrollToBottom]);

  const handleAllowAllForSession = useCallback(() => {
    setAllowAllForSession(true);
  }, [setAllowAllForSession]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    const message = input.trim();
    setInput('');
    setThinkingText(THINKING_MESSAGES[0]); // 发送新消息时重置为初始思考文字
    await sendMessage(message);
  }, [input, isLoading, apiKey, setSettingsOpen, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const promptSuggestions = [
    '帮我快速分析这个项目结构',
    '生成今天的开发任务清单',
    '帮我审查一段 TypeScript 代码',
  ];

  return (
    <main className="flex-1 flex flex-col chat-canvas relative">
      <div className="h-14 border-b border-border/60 flex items-center justify-between px-5 drag-region bg-background/55 backdrop-blur-xl">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,hsl(var(--primary)/0.3),hsl(var(--cool-accent)/0.28))] border border-border/60 flex items-center justify-center shadow-[0_6px_20px_hsl(var(--cool-accent)/0.2)]">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm tracking-[0.04em] text-foreground/95">AI Assistant</h1>
            <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-border/50 bg-secondary/60 text-muted-foreground/80">
              Agent Mode
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearHistory}
            title="清除对话"
            aria-label="清除当前对话"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/70 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="设置"
            aria-label="打开设置"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/70 rounded-lg"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
        <div className="max-w-4xl mx-auto px-6 py-7 space-y-4">
          {currentMessages.length === 0 && streamItems.length === 0 && !isLoading && (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl border border-border/60 bg-[linear-gradient(145deg,hsl(var(--primary)/0.25),hsl(var(--cool-accent)/0.2))] flex items-center justify-center mx-auto mb-6 shadow-[0_20px_40px_hsl(var(--background)/0.65)]">
                <Sparkles className="h-10 w-10 text-[hsl(var(--foreground))]" />
              </div>
              <h2 className="text-2xl font-semibold mb-3 text-foreground tracking-tight">开始新对话</h2>
              <p className="text-muted-foreground text-[15px] max-w-xl mx-auto leading-7">
                一个面向开发效率的 AI 对话工作台。你可以直接提问，也可以从下面的快捷提示开始。
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-3">
                {promptSuggestions.map((prompt, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="no-drag rounded-xl border border-border/60 bg-secondary/45 hover:bg-secondary/75 text-left px-3 py-2.5 text-sm text-foreground/85 transition-all duration-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentMessages.map((msg, i) => (
            msg.role === 'user' ? (
              // 用户消息
              <div
                key={`${msg.role}-${msg.timestamp ?? i}-${i}`}
                className="message-enter flex justify-end"
              >
                <div className="px-4 py-3.5 rounded-2xl max-w-[82%] user-message rounded-br-md shadow-[0_12px_30px_hsl(var(--primary)/0.12)]">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            ) : msg.items && msg.items.length > 0 ? (
              // Assistant 消息带有 items（工具调用记录）
              <div key={`${msg.role}-${msg.timestamp ?? i}-${i}`} className="space-y-2">
                {msg.items.map((item, j) => (
                  item.type === 'text' ? (
                    <div key={`${i}-text-${j}`} className="flex justify-start message-enter">
                      <div className="px-4 py-3.5 rounded-2xl rounded-bl-md assistant-message max-w-[82%]">
                        <MarkdownRenderer content={item.content} />
                      </div>
                    </div>
                  ) : (
                    <div key={`${i}-tool-${item.toolCall.id}`} className="flex justify-start message-enter">
                      <div className="w-full max-w-[85%]">
                        <ToolCallBlock toolCall={item.toolCall} />
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              // 普通 assistant 消息（旧格式，只有 content）
              <div
                key={`${msg.role}-${msg.timestamp ?? i}-${i}`}
                className="message-enter flex justify-start"
              >
                <div className="px-4 py-3.5 rounded-2xl max-w-[82%] assistant-message rounded-bl-md">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            )
          ))}

          {/* 流式内容和工具调用按顺序穿插展示 */}
          {streamItems.map((item, i) => (
            item.type === 'text' ? (
              <div key={`text-${i}`} className="flex justify-start message-enter">
                <div className="px-4 py-3.5 rounded-2xl rounded-bl-md assistant-message max-w-[82%]">
                  {/* Stream mode uses plain text for smooth incremental rendering. */}
                  <div className="whitespace-pre-wrap break-words text-[0.9375rem]">
                    {item.content}
                  </div>
                </div>
              </div>
            ) : (
              <div key={`tool-${item.toolCall.id}`} className="flex justify-start message-enter">
                <div className="w-full max-w-[85%]">
                  <ToolCallBlock 
                    toolCall={item.toolCall}
                    onApprove={approveToolCall}
                    onReject={rejectToolCall}
                    onAllowForSession={allowToolForSession}
                    onAllowAllForSession={handleAllowAllForSession}
                  />
                </div>
              </div>
            )
          ))}

          {hasPendingApproval && (
            <div className="flex justify-start message-enter">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-foreground/85">等待你确认工具调用</span>
                </div>
                {showWaitDurationHint && activeWaitStage === 'approval' && (
                  <div className="mt-1 text-xs text-yellow-200/80">
                    已等待 {waitElapsedSec} 秒
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 思考中提示：仅在等待模型继续输出时显示 */}
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
                  <div className="mt-1.5 text-xs text-foreground/55">
                    当前阶段已等待 {waitElapsedSec} 秒
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 已经有部分输出但还在继续生成时，保持一个轻量状态提示，避免“半句卡住”的错觉 */}
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
                  <div className="mt-1 text-[11px] text-foreground/50">
                    当前阶段已等待 {waitElapsedSec} 秒
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-4 bg-background/45 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end composer-shell rounded-xl border border-border/60 p-2.5 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息… (Enter 发送)"
              className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[0.95rem] placeholder:text-muted-foreground/60"
              rows={1}
            />
            {isLoading ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={cancelStream}
                aria-label="停止生成"
                className="h-10 w-10 rounded-xl shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="发送消息"
                className="h-10 w-10 rounded-xl shrink-0 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--cool-accent)))] text-black/85 hover:opacity-90 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-center text-[11px] text-muted-foreground/65 mt-2 tracking-[0.04em]">
            Shift+Enter 换行 · 结果可能有误，请核实关键操作
          </p>
        </div>
      </div>
    </main>
  );
}
