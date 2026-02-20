import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Trash2, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useConfigStore } from '@/stores/config-store';
import { cn } from '@/lib/utils';

export function ChatArea() {
  const { currentMessages } = useSessionStore();
  const { isLoading, streamingContent, sendMessage, cancelStream, clearHistory, initStreamListener } = useChatStore();
  const { setSettingsOpen, apiKey } = useConfigStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    initStreamListener();
  }, [initStreamListener]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, streamingContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    const message = input.trim();
    setInput('');
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
      <div className="h-14 border-b border-border flex items-center justify-between px-4 drag-region">
        <h1 className="font-semibold text-lg no-drag">AI Desktop Assistant</h1>
        <div className="flex items-center gap-2 no-drag">
          <Button variant="ghost" size="icon" onClick={clearHistory} title="清除对话">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="设置">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-4">
          {currentMessages.length === 0 && !streamingContent && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤖</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">欢迎使用 AI Desktop Assistant</h2>
              <p className="text-muted-foreground">开始对话，探索 AI 的无限可能</p>
            </div>
          )}

          {currentMessages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'p-4 rounded-lg',
                msg.role === 'user' ? 'bg-primary/10 ml-12' : 'bg-card mr-12'
              )}
            >
              <MarkdownRenderer content={msg.content} />
            </div>
          ))}

          {streamingContent && (
            <div className="p-4 rounded-lg bg-card mr-12">
              <MarkdownRenderer content={streamingContent} />
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="p-4 rounded-lg bg-card mr-12">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            className="min-h-[44px] max-h-[200px]"
            rows={1}
          />
          {isLoading ? (
            <Button variant="destructive" size="icon" onClick={cancelStream}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
