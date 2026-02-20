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
    <div className="w-72 min-w-72 border-r border-border bg-card/50 flex flex-col drag-region">
      {/* Header with macOS traffic light space */}
      <div className="pt-12 px-4 pb-4 border-b border-border no-drag">
        <Button onClick={() => createSession()} className="w-full gap-2" size="lg">
          <Plus className="h-4 w-4" />
          新对话
        </Button>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1 no-drag">
        <div className="p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">暂无对话记录</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={cn(
                  'group p-3 rounded-lg cursor-pointer transition-colors border',
                  session.id === currentSessionId
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-transparent border-transparent hover:bg-accent/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{session.title}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleRename(e, session.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={(e) => handleDelete(e, session.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[150px]">{session.preview || '无消息'}</span>
                  <span className="shrink-0">{formatTime(session.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
