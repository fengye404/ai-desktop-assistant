import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles/globals.css';

function installGlobalRuntimeHandlers() {
  window.addEventListener('error', (event) => {
    console.error('[renderer] Global error:', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[renderer] Unhandled rejection:', event.reason);
  });
}

function renderFatalBootstrapError(message: string) {
  document.body.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#101219,#0E1016);color:#EAECF0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:720px;width:100%;border:1px solid rgba(234,153,67,0.42);background:linear-gradient(160deg,rgba(234,153,67,0.14),rgba(23,26,33,0.96));border-radius:14px;padding:20px;">
        <div style="font-weight:600;font-size:18px;">Renderer 启动失败</div>
        <div style="margin-top:10px;line-height:1.6;font-size:14px;opacity:0.95;">${message}</div>
      </div>
    </div>
  `;
}

installGlobalRuntimeHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) {
  const message = 'HTML 缺少 #root 挂载节点。请检查 src/renderer/index.html。';
  console.error(`[renderer] ${message}`);
  renderFatalBootstrapError(message);
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );

  requestAnimationFrame(() => {
    if (document.body) {
      document.body.dataset.rendererReady = 'true';
    }
  });
}
