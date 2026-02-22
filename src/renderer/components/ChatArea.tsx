import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Trash2, Settings, Sparkles, Bot, AlertTriangle, TerminalSquare, FolderOpen, FileCode2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useConfigStore } from '@/stores/config-store';
import { electronApiClient } from '@/services/electron-api-client';
import {
  applyAutocompleteReplacement,
  extractAutocompleteTarget,
  type ComposerAutocompleteTarget,
} from '@/lib/composer-autocomplete';
import {
  getSlashCommandSuggestions,
  parseSlashCommand,
} from '@/lib/slash-commands';

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

interface ComposerAutocompleteItem {
  key: string;
  kind: 'slash' | 'path';
  insertValue: string;
  label: string;
  description: string;
  appendTrailingSpace: boolean;
  isDirectory?: boolean;
}

interface ComposerAutocompleteState {
  target: ComposerAutocompleteTarget;
  items: ComposerAutocompleteItem[];
  selectedIndex: number;
}

function pickAutocompleteSelectedIndex(
  previousState: ComposerAutocompleteState | null,
  target: ComposerAutocompleteTarget,
  nextItems: ComposerAutocompleteItem[],
): number {
  if (!previousState || previousState.items.length === 0 || nextItems.length === 0) {
    return 0;
  }

  if (previousState.target.kind !== target.kind) {
    return 0;
  }

  const previousSelected = previousState.items[previousState.selectedIndex];
  if (!previousSelected) {
    return 0;
  }

  const sameKeyIndex = nextItems.findIndex((item) => item.key === previousSelected.key);
  if (sameKeyIndex >= 0) {
    return sameKeyIndex;
  }

  return Math.min(previousState.selectedIndex, nextItems.length - 1);
}

function renderHighlightedLabel(label: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return label;
  }

  const lowerLabel = label.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const matchIndex = lowerLabel.indexOf(lowerQuery);
  if (matchIndex < 0) {
    return label;
  }

  const prefix = label.slice(0, matchIndex);
  const matched = label.slice(matchIndex, matchIndex + normalizedQuery.length);
  const suffix = label.slice(matchIndex + normalizedQuery.length);

  return (
    <>
      {prefix}
      <span className="rounded-sm bg-[hsl(var(--cool-accent)/0.22)] px-0.5 text-[hsl(var(--cool-accent))] font-medium">{matched}</span>
      {suffix}
    </>
  );
}

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
  const [autocomplete, setAutocomplete] = useState<ComposerAutocompleteState | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listenerInitialized = useRef(false);
  const waitStartTimestampRef = useRef<number | null>(null);
  const inputRef = useRef(input);
  const pathAutocompleteRequestSeqRef = useRef(0);
  const suppressCursorAutocompleteRefreshRef = useRef(false);
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

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    if (!autocomplete) return;
    requestAnimationFrame(() => {
      const active = document.querySelector<HTMLElement>('[data-autocomplete-active="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }, [autocomplete]);

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

  const updateAutocomplete = useCallback(async (value: string, cursor: number) => {
    const target = extractAutocompleteTarget(value, cursor);
    if (!target) {
      pathAutocompleteRequestSeqRef.current += 1;
      setAutocomplete(null);
      return;
    }

    if (target.kind === 'slash') {
      pathAutocompleteRequestSeqRef.current += 1;
      const commandSuggestions = getSlashCommandSuggestions(target.query)
        .slice(0, 8)
        .map<ComposerAutocompleteItem>((command) => ({
          key: `slash:${command.name}`,
          kind: 'slash',
          insertValue: `/${command.name}`,
          label: command.usage,
          description: command.description,
          appendTrailingSpace: true,
        }));

      if (commandSuggestions.length === 0) {
        setAutocomplete(null);
        return;
      }

      setAutocomplete((previous) => ({
        target,
        items: commandSuggestions,
        selectedIndex: pickAutocompleteSelectedIndex(previous, target, commandSuggestions),
      }));
      return;
    }

    const requestId = pathAutocompleteRequestSeqRef.current + 1;
    pathAutocompleteRequestSeqRef.current = requestId;

    const rootedQuery = target.query.startsWith('/') ? target.query : `/${target.query}`;
    const pathSuggestions = await electronApiClient.autocompletePaths(rootedQuery);
    if (requestId !== pathAutocompleteRequestSeqRef.current) {
      return;
    }

    if (inputRef.current !== value) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    if ((textarea.selectionStart ?? value.length) !== cursor) {
      return;
    }

    const pathItems = pathSuggestions
      .slice(0, 8)
      .map<ComposerAutocompleteItem>((item) => ({
        key: `path:${item.value}`,
        kind: 'path',
        insertValue: `@${item.value}`,
        label: item.value,
        description: item.isDirectory ? '目录' : '文件',
        appendTrailingSpace: !item.isDirectory,
        isDirectory: item.isDirectory,
      }));

    if (pathItems.length === 0) {
      setAutocomplete(null);
      return;
    }

    setAutocomplete((previous) => ({
      target,
      items: pathItems,
      selectedIndex: pickAutocompleteSelectedIndex(previous, target, pathItems),
    }));
  }, []);

  const refreshAutocompleteFromTextarea = useCallback((valueOverride?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const value = valueOverride ?? textarea.value;
    const cursor = textarea.selectionStart ?? value.length;
    void updateAutocomplete(value, cursor);
  }, [updateAutocomplete]);

  const applyAutocompleteItem = useCallback((index: number) => {
    if (!autocomplete) return false;

    const item = autocomplete.items[index];
    if (!item) return false;

    const next = applyAutocompleteReplacement(
      input,
      autocomplete.target,
      item.insertValue,
      item.appendTrailingSpace,
    );

    setInput(next.value);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(next.cursor, next.cursor);
      void updateAutocomplete(next.value, next.cursor);
    });
    return true;
  }, [autocomplete, input, updateAutocomplete]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    const isSlashCommand = Boolean(parseSlashCommand(message));
    if (!isSlashCommand && !apiKey) {
      setSettingsOpen(true);
      return;
    }
    pathAutocompleteRequestSeqRef.current += 1;
    setAutocomplete(null);
    setInput('');
    setThinkingText(THINKING_MESSAGES[0]); // 发送新消息时重置为初始思考文字
    await sendMessage(message);
  }, [input, isLoading, apiKey, setSettingsOpen, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete && autocomplete.items.length > 0) {
      const isNextKey = e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'n' || e.key === 'N'));
      const isPrevKey = e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'p' || e.key === 'P'));

      if (isNextKey) {
        suppressCursorAutocompleteRefreshRef.current = true;
        e.preventDefault();
        setAutocomplete((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % prev.items.length,
          };
        });
        return;
      }

      if (isPrevKey) {
        suppressCursorAutocompleteRefreshRef.current = true;
        e.preventDefault();
        setAutocomplete((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % prev.items.length,
          };
        });
        return;
      }

      if (e.key === 'Escape') {
        suppressCursorAutocompleteRefreshRef.current = true;
        e.preventDefault();
        setAutocomplete(null);
        return;
      }

      if (e.key === 'Tab') {
        suppressCursorAutocompleteRefreshRef.current = true;
        e.preventDefault();
        applyAutocompleteItem(autocomplete.selectedIndex);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        suppressCursorAutocompleteRefreshRef.current = true;
        e.preventDefault();
        applyAutocompleteItem(autocomplete.selectedIndex);
        return;
      }
    }

    if (e.key === 'Tab') {
      const textarea = textareaRef.current;
      if (textarea) {
        const value = textarea.value;
        const cursor = textarea.selectionStart ?? value.length;
        const target = extractAutocompleteTarget(value, cursor);
        if (target) {
          e.preventDefault();
          void updateAutocomplete(value, cursor);
        }
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setInput(nextValue);
    void updateAutocomplete(nextValue, e.target.selectionStart ?? nextValue.length);
  };

  const handleInputCursorChange = () => {
    if (suppressCursorAutocompleteRefreshRef.current) {
      suppressCursorAutocompleteRefreshRef.current = false;
      return;
    }
    refreshAutocompleteFromTextarea();
  };

  const handleInputKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') {
      return;
    }

    if ((e.ctrlKey && (e.key === 'n' || e.key === 'N' || e.key === 'p' || e.key === 'P')) && autocomplete) {
      return;
    }

    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && autocomplete) {
      return;
    }
    refreshAutocompleteFromTextarea();
  };

  const promptSuggestions = [
    '帮我快速分析这个项目结构',
    '生成今天的开发任务清单',
    '帮我审查一段 TypeScript 代码',
  ];

  return (
    <main className="chat-canvas relative flex flex-1 flex-col">
      <div className="drag-region flex h-14 items-center justify-between border-b border-border/55 bg-background/55 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--cool-accent)/0.2))] border border-border/60 flex items-center justify-center shadow-[0_6px_16px_hsl(var(--cool-accent)/0.14)]">
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
              <div className="w-20 h-20 rounded-2xl border border-border/60 bg-[linear-gradient(145deg,hsl(var(--primary)/0.2),hsl(var(--cool-accent)/0.16))] flex items-center justify-center mx-auto mb-6 shadow-[0_18px_32px_hsl(var(--background)/0.58)]">
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
                  <MarkdownRenderer content={item.content} />
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
              <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message border border-primary/35 bg-primary/12">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground/85">等待你确认工具调用</span>
                </div>
                {showWaitDurationHint && activeWaitStage === 'approval' && (
                  <div className="mt-1 text-xs text-primary/85">
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

      <div className="border-t border-border/55 bg-background/45 p-4 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {autocomplete && autocomplete.items.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 no-drag rounded-xl border border-border/70 bg-[linear-gradient(160deg,hsl(var(--secondary)/0.96),hsl(222_18%_11%/0.96))] shadow-[0_14px_30px_hsl(var(--background)/0.55)] overflow-hidden z-20">
                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {autocomplete.items.map((item, index) => {
                    const selected = index === autocomplete.selectedIndex;
                    const icon = item.kind === 'slash'
                      ? <TerminalSquare className="h-3.5 w-3.5 text-foreground/70" />
                      : item.isDirectory
                        ? <FolderOpen className="h-3.5 w-3.5 text-[hsl(var(--cool-accent))]" />
                        : <FileCode2 className="h-3.5 w-3.5 text-primary" />;
                    const highlightedLabel = renderHighlightedLabel(item.label, autocomplete.target.query);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        data-autocomplete-active={selected ? 'true' : 'false'}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyAutocompleteItem(index);
                        }}
                        className={[
                          'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150',
                          selected
                            ? 'bg-[linear-gradient(125deg,hsl(var(--cool-accent)/0.2),hsl(var(--secondary)/0.84))] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--cool-accent)/0.36),0_6px_12px_hsl(var(--background)/0.28)]'
                            : 'bg-transparent text-foreground/88 hover:bg-secondary/72',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm break-all flex items-center gap-2">
                            {icon}
                            <span>{highlightedLabel}</span>
                          </span>
                          <span className={[
                            'text-[11px] uppercase tracking-[0.08em] shrink-0',
                            selected ? 'text-foreground/85' : 'text-muted-foreground/80',
                          ].join(' ')}>
                            {item.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground/75 border-t border-border/45 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">Tab</span>
                    <span>补全</span>
                    <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">↑ ↓</span>
                    <span>选择</span>
                    <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">Enter</span>
                    <span>应用</span>
                  </span>
                  <span className="text-[hsl(var(--cool-accent))]">
                    {autocomplete.selectedIndex + 1}/{autocomplete.items.length}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 items-end composer-shell rounded-xl border border-border/60 p-2.5 transition-all">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={handleInputCursorChange}
                onKeyUp={handleInputKeyUp}
                onSelect={handleInputCursorChange}
                onBlur={() => setAutocomplete(null)}
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
                  className="h-10 w-10 rounded-xl shrink-0 text-primary-foreground shadow-primary/20 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/65 mt-2 tracking-[0.04em]">
            Shift+Enter 换行 · 结果可能有误，请核实关键操作
          </p>
        </div>
      </div>
    </main>
  );
}
