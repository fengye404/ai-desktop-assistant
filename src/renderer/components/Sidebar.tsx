import { Plus, MessageSquare, Trash2, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { sessions, currentSessionId, createSession, switchSession, deleteSession, renameSession } =
    useSessionStore();

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

  return (
    <div className="w-64 min-w-64 border-r border-border/50 sidebar flex flex-col drag-region">
      {/* Header with macOS traffic light space */}
      <div className="pt-10 px-3 pb-3 no-drag">
        <Button 
          onClick={() => createSession()} 
          className="w-full gap-2 h-10 bg-secondary hover:bg-secondary/80 text-foreground border border-border/50" 
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">新对话</span>
        </Button>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1 no-drag">
        <div className="px-2 pb-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>暂无对话记录</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={cn(
                  'group px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 session-item',
                  session.id === currentSessionId && 'active'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      session.id === currentSessionId ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm truncate font-medium">{session.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleRename(e, session.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(e, session.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[140px] opacity-70">{session.preview || '无消息'}</span>
                  <span className="shrink-0 opacity-50">{formatTime(session.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/30 no-drag">
        <p className="text-xs text-muted-foreground/50 text-center">
          AI Desktop Assistant
        </p>
      </div>
    </div>
  );
}
