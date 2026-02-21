import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Trash2, Settings, Sparkles, Bot } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useConfigStore } from '@/stores/config-store';
import { cn } from '@/lib/utils';

const THINKING_MESSAGES = [
  '思考中...',
  '正在分析你的问题...',
  '让我想想...',
  '组织回答中...',
  '处理中...',
];

export function ChatArea() {
  const { currentMessages } = useSessionStore();
  const { isLoading, streamItems, sendMessage, cancelStream, clearHistory, initStreamListener, approveToolCall, rejectToolCall } = useChatStore();
  const { setSettingsOpen, apiKey, allowToolForSession, setAllowAllForSession } = useConfigStore();
  const [input, setInput] = useState('');
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listenerInitialized = useRef(false);

  // 只初始化一次流式监听器
  useEffect(() => {
    if (!listenerInitialized.current) {
      initStreamListener();
      listenerInitialized.current = true;
    }
  }, [initStreamListener]);

  // 动态切换思考文字
  useEffect(() => {
    if (isLoading && streamItems.length === 0) {
      const interval = setInterval(() => {
        setThinkingText(prev => {
          const currentIndex = THINKING_MESSAGES.indexOf(prev);
          const nextIndex = (currentIndex + 1) % THINKING_MESSAGES.length;
          return THINKING_MESSAGES[nextIndex];
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLoading, streamItems.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, streamItems]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    const message = input.trim();
    setInput('');
    setThinkingText(THINKING_MESSAGES[0]);
    await sendMessage(message);
  }, [input, isLoading, apiKey, setSettingsOpen, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-12 border-b border-border/50 flex items-center justify-between px-4 drag-region bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h1 className="font-medium text-sm text-foreground/90">AI Assistant</h1>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearHistory} 
            title="清除对话"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSettingsOpen(true)} 
            title="设置"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {currentMessages.length === 0 && streamItems.length === 0 && !isLoading && (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">开始新对话</h2>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                我是你的 AI 助手，可以帮你回答问题、写代码、分析数据，或者只是聊聊天。
              </p>
            </div>
          )}

          {currentMessages.map((msg, i) => (
            msg.role === 'user' ? (
              // 用户消息
              <div
                key={i}
                className="message-enter flex justify-end"
              >
                <div className="px-4 py-3 rounded-2xl max-w-[85%] user-message rounded-br-md">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            ) : msg.items && msg.items.length > 0 ? (
              // Assistant 消息带有 items（工具调用记录）
              <div key={i} className="space-y-2">
                {msg.items.map((item, j) => (
                  item.type === 'text' ? (
                    <div key={`${i}-text-${j}`} className="flex justify-start message-enter">
                      <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message max-w-[85%]">
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
                key={i}
                className="message-enter flex justify-start"
              >
                <div className="px-4 py-3 rounded-2xl max-w-[85%] assistant-message rounded-bl-md">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            )
          ))}

          {/* 流式内容和工具调用按顺序穿插展示 */}
          {streamItems.map((item, i) => (
            item.type === 'text' ? (
              <div key={`text-${i}`} className="flex justify-start message-enter">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message max-w-[85%]">
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
                    onAllowAllForSession={() => setAllowAllForSession(true)}
                  />
                </div>
              </div>
            )
          ))}

          {isLoading && streamItems.length === 0 && (
            <div className="flex justify-start message-enter">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md assistant-message">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bot className="h-5 w-5 text-primary animate-pulse" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-foreground/80">{thinkingText}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 loading-dot" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border/50 p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end input-glow rounded-xl bg-secondary/50 border border-border/50 p-2 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送)"
              className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[0.9375rem] placeholder:text-muted-foreground/60"
              rows={1}
            />
            {isLoading ? (
              <Button 
                variant="destructive" 
                size="icon" 
                onClick={cancelStream}
                className="h-9 w-9 rounded-lg shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={!input.trim()}
                className="h-9 w-9 rounded-lg shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            Shift+Enter 换行 · AI 可能会出错，请核实重要信息
          </p>
        </div>
      </div>
    </div>
  );
}
