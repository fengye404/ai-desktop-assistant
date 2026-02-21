import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS, type ToolApprovalRequest } from '../types';

interface PendingApproval {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Coordinates tool approval requests between main process and renderer.
 * Keeps at most one pending approval and enforces timeout fallback.
 */
export class ToolApprovalCoordinator {
  private pendingApproval: PendingApproval | null = null;

  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly timeoutMs: number = 300000,
  ) {}

  async requestApproval(request: ToolApprovalRequest): Promise<boolean> {
    const window = this.getMainWindow();
    if (!window || window.isDestroyed()) {
      return false;
    }

    // Auto-reject previous request if a new one arrives unexpectedly.
    this.clearPendingApproval(false);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.clearPendingApproval(false);
      }, this.timeoutMs);

      this.pendingApproval = { resolve, timer };
      window.webContents.send(IPC_CHANNELS.TOOL_APPROVAL_REQUEST, request);
    });
  }

  respond(approved: boolean): void {
    this.clearPendingApproval(approved);
  }

  dispose(): void {
    this.clearPendingApproval(false);
  }

  private clearPendingApproval(defaultValue: boolean): void {
    if (!this.pendingApproval) return;
    clearTimeout(this.pendingApproval.timer);
    this.pendingApproval.resolve(defaultValue);
    this.pendingApproval = null;
  }
}
