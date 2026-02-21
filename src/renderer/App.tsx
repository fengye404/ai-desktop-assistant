import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import {
  useCallback,
  useEffect,
  lazy,
  Suspense,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useConfigStore } from './stores/config-store';
import { useSessionStore } from './stores/session-store';

const SIDEBAR_WIDTH_STORAGE_KEY = 'ui.sidebar.width';
const SIDEBAR_WIDTH_DEFAULT = 320;
const SIDEBAR_WIDTH_MIN = 260;
const SIDEBAR_WIDTH_MAX = 520;
const SIDEBAR_WIDTH_STEP = 12;

const LazySettingsDialog = lazy(() =>
  import('./components/SettingsDialog').then((module) => ({
    default: module.SettingsDialog,
  }))
);

export default function App() {
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const isSettingsOpen = useConfigStore((s) => s.isSettingsOpen);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_WIDTH_DEFAULT;
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    if (!Number.isFinite(saved)) return SIDEBAR_WIDTH_DEFAULT;
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, saved));
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    void Promise.allSettled([loadConfig(), loadSessions()]);
  }, [loadConfig, loadSessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const resizeState = resizeRef.current;
    if (!resizeState) return;

    const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
    const clampedWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, nextWidth));
    setSidebarWidth(clampedWidth);
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
    resizeRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handlePointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove, handlePointerUp, sidebarWidth]);

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth((prev) => Math.max(SIDEBAR_WIDTH_MIN, prev - SIDEBAR_WIDTH_STEP));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((prev) => Math.min(SIDEBAR_WIDTH_MAX, prev + SIDEBAR_WIDTH_STEP));
    }
  }, []);

  return (
    <div className="app-shell h-screen overflow-hidden">
      <div className="relative flex h-full w-full overflow-hidden bg-background/82 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.03)] backdrop-blur-xl">
        <Sidebar width={sidebarWidth} />
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="调整会话面板宽度"
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          onPointerDown={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
          className={`sidebar-resizer no-drag relative z-20 h-full w-3 shrink-0 cursor-col-resize outline-none ${isResizing ? 'is-resizing' : ''}`}
        >
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70 shadow-[1px_0_0_hsl(0_0%_100%/0.04)] transition-colors duration-150" />
        </div>
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
