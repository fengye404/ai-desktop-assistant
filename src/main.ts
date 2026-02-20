import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import * as path from 'path';
import { ClaudeService } from './claude-service';
import { SessionStorage } from './session-storage';
import { IPC_CHANNELS } from './types';
import type { ModelConfig, StreamChunk } from './types';
import { ServiceNotInitializedError, StreamAbortedError } from './utils/errors';

let mainWindow: BrowserWindow | null = null;
let claudeService: ClaudeService | null = null;
let sessionStorage: SessionStorage | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize Claude service
function initClaudeService(): void {
  sessionStorage = new SessionStorage();
  claudeService = new ClaudeService(sessionStorage);

  // Create initial session if none exists
  if (sessionStorage.listSessions().length === 0) {
    sessionStorage.createSession();
  } else {
    // Switch to most recent session
    const sessions = sessionStorage.listSessions();
    if (sessions.length > 0) {
      sessionStorage.switchSession(sessions[0].id);
    }
  }
}

// IPC Handlers
ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE, async (_event, message: string, systemPrompt?: string) => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }
  return await claudeService.sendMessage(message, systemPrompt);
});

ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE_STREAM, async (_event, message: string, systemPrompt?: string) => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }

  try {
    const stream = claudeService.sendMessageStream(message, systemPrompt);

    for await (const chunk of stream) {
      // Check if window is still valid
      if (mainWindow?.isDestroyed()) {
        break;
      }
      mainWindow?.webContents.send(IPC_CHANNELS.STREAM_CHUNK, chunk);
    }

    // Send done signal
    mainWindow?.webContents.send(IPC_CHANNELS.STREAM_CHUNK, { type: 'done', content: '' } as StreamChunk);

    return true;
  } catch (error) {
    if (error instanceof StreamAbortedError) {
      mainWindow?.webContents.send(IPC_CHANNELS.STREAM_CHUNK, {
        type: 'error',
        content: 'Response was cancelled',
      } as StreamChunk);
      return false;
    }
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.ABORT_STREAM, async () => {
  if (claudeService) {
    claudeService.abort();
  }
});

ipcMain.handle(IPC_CHANNELS.SET_MODEL_CONFIG, async (_event, config: Partial<ModelConfig>) => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }
  claudeService.setConfig(config);
  return true;
});

ipcMain.handle(IPC_CHANNELS.TEST_CONNECTION, async () => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }
  return await claudeService.testConnection();
});

ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }
  claudeService.clearHistory();
});

ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
  if (!claudeService) {
    throw new ServiceNotInitializedError('Claude service');
  }
  return claudeService.getHistory();
});

// Encryption handlers for secure storage
ipcMain.handle(IPC_CHANNELS.ENCRYPT_DATA, async (_event, data: string): Promise<string> => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Encryption not available, storing data in plain text');
      return `plain:${data}`;
    }
    const encryptedBuffer = safeStorage.encryptString(data);
    return encryptedBuffer.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to plain text
    return `plain:${data}`;
  }
});

ipcMain.handle(IPC_CHANNELS.DECRYPT_DATA, async (_event, encryptedData: string): Promise<string> => {
  // Handle plain text fallback
  if (encryptedData.startsWith('plain:')) {
    return encryptedData.slice(6);
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Decryption not available on this system');
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decryption failed';
    throw new Error(`Failed to decrypt data: ${message}`);
  }
});

// Session management handlers
ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.listSessions();
});

ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_event, id: string) => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.getSession(id);
});

ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_event, title?: string) => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.createSession(title);
});

ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string) => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.deleteSession(id);
});

ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, async (_event, id: string) => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.switchSession(id);
});

ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, async (_event, id: string, title: string) => {
  if (!sessionStorage) {
    throw new ServiceNotInitializedError('Session storage');
  }
  return sessionStorage.renameSession(id, title);
});

// App lifecycle
app.whenReady().then(() => {
  initClaudeService();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  claudeService?.cleanup();
});
