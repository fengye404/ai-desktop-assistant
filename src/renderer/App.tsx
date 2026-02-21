import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { useEffect, lazy, Suspense, useState } from 'react';
import { useConfigStore } from './stores/config-store';
import { useSessionStore } from './stores/session-store';
import { electronApiClient } from './services/electron-api-client';

const LazySettingsDialog = lazy(() =>
  import('./components/SettingsDialog').then((module) => ({
    default: module.SettingsDialog,
  }))
);

type BridgeStatus = 'checking' | 'ready' | 'missing';

const BRIDGE_CHECK_INTERVAL_MS = 120;
const BRIDGE_CHECK_MAX_ATTEMPTS = 30;

export default function App() {
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const [startupIssue, setStartupIssue] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('checking');

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const verifyBridge = () => {
      if (disposed) return;

      if (electronApiClient.isAvailable()) {
        setBridgeStatus('ready');
        return;
      }

      attempts += 1;
      if (attempts >= BRIDGE_CHECK_MAX_ATTEMPTS) {
        setBridgeStatus('missing');
        return;
      }

      timer = setTimeout(verifyBridge, BRIDGE_CHECK_INTERVAL_MS);
    };

    verifyBridge();

    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      const [configResult, sessionResult] = await Promise.allSettled([
        loadConfig(),
        loadSessions(),
      ]);

      if (disposed) return;

      const issues: string[] = [];

      if (configResult.status === 'rejected') {
        issues.push(`配置加载失败: ${String(configResult.reason)}`);
      }
      if (sessionResult.status === 'rejected') {
        issues.push(`会话加载失败: ${String(sessionResult.reason)}`);
      }

      setStartupIssue(issues.length > 0 ? issues.join('；') : null);
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, [loadConfig, loadSessions]);

  return (
    <div className="app-shell h-screen overflow-hidden p-3">
      <div className="relative flex h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-background/75 shadow-[0_24px_80px_hsl(225_35%_2%/0.65)] backdrop-blur-xl">
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 w-[min(760px,calc(100%-2rem))] -translate-x-1/2 space-y-2">
          {bridgeStatus === 'missing' && (
            <div className="pointer-events-auto rounded-xl border border-amber-400/35 bg-amber-500/14 px-4 py-2 text-xs text-amber-100 shadow-[0_10px_26px_hsl(45_90%_20%/0.28)]">
              Renderer 未检测到 Electron bridge（`window.electronAPI`），已进入安全降级模式。
            </div>
          )}
          {startupIssue && (
            <div className="pointer-events-auto rounded-xl border border-red-400/35 bg-red-500/14 px-4 py-2 text-xs text-red-100 shadow-[0_10px_26px_hsl(0_80%_20%/0.26)]">
              启动阶段检测到异常：{startupIssue}
            </div>
          )}
        </div>
        <Sidebar />
        <ChatArea />
        {isSettingsOpen && (
          <Suspense fallback={null}>
            <LazySettingsDialog />
          </Suspense>
        )}
      </div>
    </div>
  );
}
