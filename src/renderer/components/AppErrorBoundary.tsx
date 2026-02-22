import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[renderer] Uncaught render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="h-screen w-screen flex items-center justify-center p-6 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(225_26%_5%))] text-foreground">
        <div className="max-w-xl w-full rounded-2xl border border-destructive/35 bg-[linear-gradient(160deg,hsl(var(--destructive)/0.18),hsl(var(--card)/0.94))] p-6 shadow-[0_24px_64px_hsl(var(--background)/0.68)]">
          <h1 className="text-lg font-semibold text-foreground">页面渲染异常</h1>
          <p className="mt-2 text-sm text-foreground/88">
            应用在渲染时发生未捕获错误。你可以先重载页面，如果问题持续请查看控制台日志。
          </p>
          <pre className="mt-4 rounded-lg border border-destructive/30 bg-background/55 p-3 text-xs text-foreground/80 whitespace-pre-wrap break-all">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-border/60 bg-[linear-gradient(135deg,hsl(var(--primary)/0.94),hsl(var(--cool-accent)/0.76))] px-3 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/16 hover:brightness-[1.03]"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
