import { Plus, MessageSquare, Trash2, Pencil, Layers2, Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';

interface SidebarProps {
  width: number;
}

export function Sidebar({ width }: SidebarProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const switchSession = useSessionStore((s) => s.switchSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editingInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingSessionId) return;

    const frame = requestAnimationFrame(() => {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [editingSessionId]);

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

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditingTitle(currentTitle);
  };

  const cancelRename = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const saveRename = async (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (!editingSessionId) return;

    const trimmedTitle = editingTitle.trim();
    const originalTitle = sessions.find((session) => session.id === editingSessionId)?.title.trim() || '';

    if (!trimmedTitle || trimmedTitle === originalTitle) {
      cancelRename();
      return;
    }

    await renameSession(editingSessionId, trimmedTitle);
    cancelRename();
  };

  const handleSessionClick = (id: string) => {
    if (editingSessionId === id) return;
    if (editingSessionId) {
      setEditingSessionId(null);
      setEditingTitle('');
    }
    void switchSession(id);
  };

  const handleSessionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (editingSessionId) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void switchSession(id);
    }
  };

  return (
    <aside
      className="sidebar relative flex shrink-0 flex-col overflow-hidden drag-region"
      style={{ width, minWidth: width }}
    >
      <div className="border-b border-border/45 px-4 pb-4 pt-12 no-drag">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--cool-accent))] shadow-[0_0_12px_hsl(var(--cool-accent)/0.75)]" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/72">Workspace</span>
          </div>
          <Layers2 className="h-3.5 w-3.5 text-muted-foreground/65" />
        </div>
        <Button
          onClick={() => createSession()}
          className="h-10 w-full justify-start gap-2.5 rounded-xl border border-border/65 bg-secondary/45 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)] hover:bg-secondary/80"
          variant="outline"
          aria-label="新建对话"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">新建会话</span>
        </Button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden no-drag">
        <div className="w-full max-w-full px-4 pb-3 pt-3">
          <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/68">Conversations</p>
          <div className="w-full max-w-full space-y-1.5 pr-1">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-secondary/25 py-12 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p>暂无对话记录</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSessionClick(session.id)}
                  onKeyDown={(e) => handleSessionKeyDown(e, session.id)}
                  tabIndex={0}
                  role="button"
                  aria-current={session.id === currentSessionId}
                  className={cn(
                    'session-item group box-border min-w-0 w-full max-w-full cursor-pointer overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-200',
                    session.id === currentSessionId ? 'active border-primary/35' : 'border-border/60'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageSquare className={cn(
                      'h-4 w-4 shrink-0 transition-colors duration-200',
                      session.id === currentSessionId ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <div
                      className={cn(
                        'session-title-pill min-w-0 flex-1 rounded-md border px-2 py-0.5',
                        session.id === currentSessionId
                          ? 'border-primary/42 bg-primary/10'
                          : 'border-border/65 bg-background/30'
                      )}
                    >
                      {session.id === editingSessionId ? (
                        <Input
                          ref={editingInputRef}
                          type="text"
                          value={editingTitle}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void saveRename();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          className="h-6 border-border/55 bg-background/45 px-2 text-sm leading-5"
                          aria-label={`编辑会话标题：${session.title}`}
                        />
                      ) : (
                        <span className="block truncate text-sm font-medium leading-5">
                          {session.title}
                        </span>
                      )}
                    </div>
                    <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity duration-150 group-hover:opacity-100">
                      {session.id === editingSessionId ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              void saveRename();
                            }}
                            title="保存标题"
                            aria-label={`保存对话标题：${session.title}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                            onClick={cancelRename}
                            title="取消编辑"
                            aria-label={`取消编辑对话：${session.title}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                            onClick={(e) => startRename(e, session.id, session.title)}
                            title="重命名对话"
                            aria-label={`重命名对话：${session.title}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary/65 hover:text-destructive"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => handleDelete(e, session.id)}
                            title="删除对话"
                            aria-label={`删除对话：${session.title}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground/88">
                    <span className="min-w-0 flex-1 truncate opacity-75">{session.preview || '无消息'}</span>
                    <span className="shrink-0 rounded-md border border-border/45 bg-background/35 px-1.5 py-0.5 opacity-80">
                      {formatTime(session.updatedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/40 p-3 no-drag">
        <p className="text-center text-[11px] uppercase tracking-[0.08em] text-muted-foreground/55">
          AI Desktop Assistant
        </p>
      </div>
    </aside>
  );
}
