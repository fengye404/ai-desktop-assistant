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
      <div className="h-screen w-screen flex items-center justify-center p-6 bg-[hsl(225_26%_6%)] text-[hsl(220_18%_94%)]">
        <div className="max-w-xl w-full rounded-2xl border border-red-500/35 bg-red-500/10 p-6 shadow-[0_24px_64px_hsl(225_40%_2%/0.65)]">
          <h1 className="text-lg font-semibold text-red-200">页面渲染异常</h1>
          <p className="mt-2 text-sm text-red-100/90">
            应用在渲染时发生未捕获错误。你可以先重载页面，如果问题持续请查看控制台日志。
          </p>
          <pre className="mt-4 rounded-lg border border-red-300/25 bg-black/25 p-3 text-xs text-red-100/85 whitespace-pre-wrap break-all">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-red-200/35 px-3 text-sm text-red-50 hover:bg-red-500/20"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
