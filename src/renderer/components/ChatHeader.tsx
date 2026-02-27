import { Sparkles, Trash2, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { BRANDING } from '../../shared/branding';

interface ChatHeaderProps {
  brandIconLoadFailed: boolean;
  onBrandIconError: () => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
}

export function ChatHeader({
  brandIconLoadFailed,
  onBrandIconError,
  onClearHistory,
  onOpenSettings,
}: ChatHeaderProps) {
  return (
    <div className="drag-region relative z-[60] flex h-14 items-center justify-between border-b border-border/55 bg-background/55 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 no-drag">
        <div className="h-8 w-8 overflow-hidden rounded-lg border border-border/60 bg-[linear-gradient(135deg,hsl(var(--primary)/0.24),hsl(var(--cool-accent)/0.2))] shadow-[0_6px_16px_hsl(var(--cool-accent)/0.14)]">
          {brandIconLoadFailed ? (
            <div className="flex h-full w-full items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <img
              src={BRANDING.rendererIconUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={onBrandIconError}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-sm tracking-[0.04em] text-foreground/95">{BRANDING.headerName}</h1>
          <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-border/50 bg-secondary/60 text-muted-foreground/80">
            Agent Mode
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 no-drag">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearHistory}
          title="清除对话"
          aria-label="清除当前对话"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/70 rounded-lg"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          title="设置"
          aria-label="打开设置"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/70 rounded-lg"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
