import { BrowserWindow } from 'electron';
import * as path from 'path';

interface CreateMainWindowOptions {
  useViteDevServer: boolean;
}

const RENDERER_READY_CHECK_DELAY_MS = 3500;

function buildLoadFailureHtml(errorCode: number, errorDescription: string, target: string): string {
  const safeTarget = target.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDescription = errorDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Renderer Load Failed</title>
    <style>
      body {
        margin: 0;
        background: #0d1117;
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        border-radius: 14px;
        border: 1px solid rgba(248, 113, 113, 0.45);
        background: rgba(239, 68, 68, 0.14);
        padding: 20px;
        line-height: 1.65;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .meta {
        margin-top: 10px;
        font-size: 13px;
        opacity: 0.92;
        word-break: break-all;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="title">Renderer 页面加载失败</div>
        <div class="meta"><code>errorCode</code>: ${errorCode}</div>
        <div class="meta"><code>errorDescription</code>: ${safeDescription}</div>
        <div class="meta"><code>target</code>: ${safeTarget}</div>
      </div>
    </div>
  </body>
</html>`;
}

function buildRendererNotReadyHtml(target: string): string {
  const safeTarget = target.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Renderer Diagnostics</title>
    <style>
      body {
        margin: 0;
        background: #0d1117;
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        border-radius: 14px;
        border: 1px solid rgba(251, 191, 36, 0.45);
        background: rgba(245, 158, 11, 0.14);
        padding: 20px;
        line-height: 1.65;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .meta {
        margin-top: 10px;
        font-size: 13px;
        opacity: 0.92;
        word-break: break-all;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="title">Renderer 未完成挂载</div>
        <div class="meta">页面加载完成后未检测到 React 根节点内容，这通常会表现为黑屏。</div>
        <div class="meta">建议检查 DevTools 控制台报错、CSP 规则和 preload bridge 初始化。</div>
        <div class="meta"><code>target</code>: ${safeTarget}</div>
      </div>
    </div>
  </body>
</html>`;
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    show: false,
  });
  let diagnosticsFallbackLoaded = false;

  if (options.useViteDevServer) {
    void window.loadURL('http://localhost:5173');
    window.webContents.openDevTools();
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  window.webContents.on('before-input-event', (_event, input) => {
    if (input.meta && input.alt && input.key === 'i') {
      window.webContents.toggleDevTools();
    }
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (diagnosticsFallbackLoaded) return;
    diagnosticsFallbackLoaded = true;

    const target = validatedURL || (options.useViteDevServer ? 'http://localhost:5173' : 'dist/renderer/index.html');
    console.error(
      `[main-window] Renderer failed to load: code=${errorCode}, description=${errorDescription}, url=${target}`,
    );

    const html = buildLoadFailureHtml(errorCode, errorDescription, target);
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  window.webContents.on('did-finish-load', () => {
    if (diagnosticsFallbackLoaded) return;

    const target = window.webContents.getURL() || (options.useViteDevServer ? 'http://localhost:5173' : 'dist/renderer/index.html');
    setTimeout(() => {
      if (window.isDestroyed() || diagnosticsFallbackLoaded) return;

      const healthCheck = `
        (() => {
          const bodyReady = document.body?.dataset?.rendererReady === 'true';
          const root = document.getElementById('root');
          const hasMountedChildren = !!root && root.children.length > 0;
          return bodyReady || hasMountedChildren;
        })()
      `;

      void window.webContents
        .executeJavaScript(healthCheck, true)
        .then((ready) => {
          if (ready || diagnosticsFallbackLoaded || window.isDestroyed()) return;

          diagnosticsFallbackLoaded = true;
          console.error('[main-window] Renderer mount health-check failed; showing diagnostics page.');
          const html = buildRendererNotReadyHtml(target);
          void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        })
        .catch((error) => {
          console.error('[main-window] Renderer mount health-check execution failed:', error);
        });
    }, RENDERER_READY_CHECK_DELAY_MS);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[main-window] Renderer process gone: ${details.reason} (exitCode=${details.exitCode})`);
  });

  return window;
}
