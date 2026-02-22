import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './main-process/ipc/register-ipc-handlers';
import { MainProcessContext } from './main-process/main-process-context';
import { createMainWindow } from './main-process/window-factory';

// Use Vite dev server only when explicitly enabled.
const useViteDevServer = process.env.VITE_DEV_SERVER === 'true';

const context = new MainProcessContext();
registerIpcHandlers(context);

function openMainWindow(): void {
  const window = createMainWindow({ useViteDevServer });
  context.setMainWindow(window);

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    context.setMainWindow(null);
    context.toolApproval.dispose();
  });
}

app.whenReady().then(async () => {
  await context.initializeServices();
  openMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  context.cleanup();
});
