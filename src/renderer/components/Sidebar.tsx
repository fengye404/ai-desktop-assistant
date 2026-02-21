import { Plus, MessageSquare, Trash2, Pencil, Layers2 } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const switchSession = useSessionStore((s) => s.switchSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const renameSession = useSessionStore((s) => s.renameSession);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个对话吗？')) {
      deleteSession(id);
    }
  };

  const handleRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTitle = prompt('输入新的对话标题：');
    if (newTitle) {
      renameSession(id, newTitle);
    }
  };

  const handleSessionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchSession(id);
    }
  };

  return (
    <aside className="w-72 min-w-72 border-r border-border/70 sidebar flex flex-col drag-region relative">
      <div className="pt-10 px-4 pb-4 no-drag border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--cool-accent))] shadow-[0_0_12px_hsl(var(--cool-accent)/0.75)]" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/75">Workspace</span>
          </div>
          <Layers2 className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
        <Button
          onClick={() => createSession()}
          className="w-full justify-start gap-2.5 h-10 rounded-xl border border-border/70 bg-secondary/55 hover:bg-secondary/85 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]"
          variant="outline"
          aria-label="新建对话"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">新建会话</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 no-drag">
        <div className="px-3 pt-3 pb-2">
          <p className="px-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70 mb-2">Conversations</p>
          <div className="space-y-1.5">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 text-center text-muted-foreground py-12 text-sm bg-secondary/25">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p>暂无对话记录</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => switchSession(session.id)}
                  onKeyDown={(e) => handleSessionKeyDown(e, session.id)}
                  tabIndex={0}
                  role="button"
                  aria-current={session.id === currentSessionId}
                  className={cn(
                    'group px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 session-item border border-transparent',
                    session.id === currentSessionId && 'active border-primary/30'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        session.id === currentSessionId ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className="text-sm truncate font-medium">{session.title}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleRename(e, session.id)}
                        title="重命名对话"
                        aria-label={`重命名对话：${session.title}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, session.id)}
                        title="删除对话"
                        aria-label={`删除对话：${session.title}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[140px] opacity-75">{session.preview || '无消息'}</span>
                    <span className="shrink-0 rounded-md bg-background/40 border border-border/40 px-1.5 py-0.5 opacity-80">
                      {formatTime(session.updatedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border/40 no-drag">
        <p className="text-[11px] text-muted-foreground/55 text-center tracking-[0.08em] uppercase">
          AI Desktop Assistant
        </p>
      </div>
    </aside>
  );
}
