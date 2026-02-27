import { useState, useCallback } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import type { RewindHistoryResult } from '../../types';

interface RecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRewind: () => Promise<RewindHistoryResult>;
  onClear: () => void;
}

export function RecoveryDialog({ open, onOpenChange, onRewind, onClear }: RecoveryDialogProps) {
  const [actionBusy, setActionBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setMessage('');
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const handleRewind = useCallback(async () => {
    setActionBusy(true);
    try {
      const result = await onRewind();
      if (result.skipped) {
        setMessage(result.reason ?? '当前没有可恢复的最近轮次。');
        return;
      }
      setMessage(`已回退最近轮次，移除 ${result.removedMessageCount} 条消息。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`回退失败：${msg}`);
    } finally {
      setActionBusy(false);
    }
  }, [onRewind]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            恢复菜单
          </DialogTitle>
          <DialogDescription>你可以撤销最近一轮对话，或直接清空当前会话。快捷键：`Esc + Esc`。</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-1 space-y-3">
          <Button type="button" variant="outline" onClick={() => { void handleRewind(); }} disabled={actionBusy} className="w-full justify-start gap-2">
            <RotateCcw className="h-4 w-4" />撤销最近一轮对话
          </Button>
          <Button type="button" variant="destructive" onClick={() => { void onClear(); onOpenChange(false); }} disabled={actionBusy} className="w-full justify-start gap-2">
            <Trash2 className="h-4 w-4" />清空当前会话
          </Button>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actionBusy}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
