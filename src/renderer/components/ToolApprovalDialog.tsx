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
  const { toolApprovalRequest, respondToolApproval } = useChatStore();

  if (!toolApprovalRequest) return null;

  return (
    <Dialog open={!!toolApprovalRequest} onOpenChange={() => respondToolApproval(false)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🔧</span> 工具权限请求
          </DialogTitle>
          <DialogDescription>AI 请求执行以下操作，是否允许？</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-secondary">
            <div className="font-medium mb-2">工具名称</div>
            <code className="text-sm">{toolApprovalRequest.tool}</code>
          </div>

          <div className="p-3 rounded-lg bg-secondary">
            <div className="font-medium mb-2">参数</div>
            <div className="space-y-2">
              {Object.entries(toolApprovalRequest.input).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground">{key}: </span>
                  <code className="bg-background px-1 rounded">{JSON.stringify(value)}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => respondToolApproval(false)}>
            拒绝
          </Button>
          <Button onClick={() => respondToolApproval(true)}>允许</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
