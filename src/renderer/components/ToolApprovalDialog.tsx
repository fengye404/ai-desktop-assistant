import { Shield, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { useChatStore } from '@/stores/chat-store';

export function ToolApprovalDialog() {
  const pendingApprovalId = useChatStore((state) => state.pendingApprovalId);
  const streamItems = useChatStore((state) => state.streamItems);
  const approveToolCall = useChatStore((state) => state.approveToolCall);
  const rejectToolCall = useChatStore((state) => state.rejectToolCall);

  if (!pendingApprovalId) return null;

  const pendingTool = streamItems.find(
    (item) => item.type === 'tool' && item.toolCall.id === pendingApprovalId,
  );

  if (!pendingTool || pendingTool.type !== 'tool') return null;

  const request = pendingTool.toolCall;

  return (
    <Dialog open={Boolean(pendingApprovalId)} onOpenChange={() => rejectToolCall(request.id)}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl border border-primary/35 bg-[linear-gradient(135deg,hsl(var(--primary)/0.3),hsl(var(--cool-accent)/0.24))] flex items-center justify-center shadow-[0_8px_18px_hsl(var(--background)/0.28)]'>
              <Shield className='h-5 w-5 text-foreground' />
            </div>
            <div>
              <DialogTitle>工具权限请求</DialogTitle>
              <DialogDescription className='mt-1'>AI 请求执行以下操作，是否允许？</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4 px-6 py-4'>
          <div className='p-4 rounded-xl bg-secondary/50 border border-border/30'>
            <div className='text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2'>工具名称</div>
            <code className='text-sm text-primary font-mono'>{request.name}</code>
          </div>

          <div className='p-4 rounded-xl bg-secondary/50 border border-border/30'>
            <div className='text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3'>参数</div>
            <div className='space-y-2.5'>
              {Object.entries(request.input).map(([key, value]) => (
                <div key={key} className='flex items-start gap-2 text-sm'>
                  <span className='text-muted-foreground min-w-[80px] shrink-0'>{key}:</span>
                  <code className='bg-background/50 px-2 py-0.5 rounded-md text-xs font-mono break-all'>
                    {JSON.stringify(value)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => rejectToolCall(request.id)}
            className='gap-2'
          >
            <X className='h-4 w-4' />
            拒绝
          </Button>
          <Button
            onClick={() => approveToolCall(request.id)}
            className='gap-2 shadow-primary/20'
          >
            <Check className='h-4 w-4' />
            允许
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
