/**
 * IPC handlers for session management.
 *
 * Sessions are now primarily managed by the SDK. This handler layer
 * delegates listing to the SDK and stores custom titles in SQLite.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { SessionMeta, Session } from '../../types';
import type { MainProcessContext } from '../main-process-context';

export function registerSessionHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async (): Promise<SessionMeta[]> => {
    const service = context.getAgentServiceOrThrow();
    const storage = context.getSessionStorageOrThrow();

    const sdkSessions = await service.listSessions();

    return sdkSessions
      .filter((s) => !storage.isSessionDeleted(s.sessionId))
      .map((s) => ({
        id: s.sessionId,
        title: storage.getSessionTitle(s.sessionId) || s.customTitle || s.summary || '新对话',
        messageCount: 0,
        createdAt: s.lastModified,
        updatedAt: s.lastModified,
        preview: s.firstPrompt || '',
      }));
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_event, id: string): Promise<Session | null> => {
    const service = context.getAgentServiceOrThrow();
    const storage = context.getSessionStorageOrThrow();

    const sdkSessions = await service.listSessions();
    const session = sdkSessions.find((s) => s.sessionId === id);
    if (!session) return null;

    return {
      id: session.sessionId,
      title: storage.getSessionTitle(session.sessionId) || session.customTitle || session.summary || '新对话',
      messages: [],
      createdAt: session.lastModified,
      updatedAt: session.lastModified,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (): Promise<Session> => {
    // Abort any in-progress query and reset session so next query starts fresh
    try {
      const service = context.getAgentServiceOrThrow();
      service.abort();
      service.setCurrentSessionId(null);
    } catch {
      // Service not initialized yet
    }

    const now = Date.now();
    return {
      id: `new_${now}`,
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string): Promise<boolean> => {
    const storage = context.getSessionStorageOrThrow();
    storage.markSessionDeleted(id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, async (_event, id: string): Promise<Session | null> => {
    const service = context.getAgentServiceOrThrow();
    const storage = context.getSessionStorageOrThrow();

    // Abort any in-progress query before switching
    service.abort();

    const sdkSessions = await service.listSessions();
    const session = sdkSessions.find((s) => s.sessionId === id);
    if (!session) return null;

    // Tell AgentService to resume this session on the next query
    service.setCurrentSessionId(session.sessionId);

    return {
      id: session.sessionId,
      title: storage.getSessionTitle(session.sessionId) || session.customTitle || session.summary || '新对话',
      messages: [],
      createdAt: session.lastModified,
      updatedAt: session.lastModified,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, async (_event, id: string, title: string): Promise<boolean> => {
    const storage = context.getSessionStorageOrThrow();
    storage.setSessionTitle(id, title);
    return true;
  });
}
