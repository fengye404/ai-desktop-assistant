/**
 * IPC handlers for session management.
 *
 * Sessions are now primarily managed by the SDK. This handler layer
 * delegates listing to the SDK and stores custom titles in SQLite.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../types';
import type { SessionMeta, Session, ChatMessage } from '../../types';
import type { MainProcessContext } from '../main-process-context';

async function loadSessionMessages(context: MainProcessContext, sessionId: string): Promise<ChatMessage[]> {
  try {
    const service = context.getAgentServiceOrThrow();
    const sdkMessages = await service.getSessionMessages(sessionId);
    return convertSdkSessionMessages(sdkMessages);
  } catch (err) {
    console.error('[session-handlers] Failed to load session messages:', err);
    return [];
  }
}

export interface SdkSessionMsg {
  type: 'user' | 'assistant';
  uuid: string;
  session_id: string;
  message: unknown;
  parent_tool_use_id: string | null;
}

export function convertSdkSessionMessages(sdkMessages: SdkSessionMsg[]): ChatMessage[] {
  const results: ChatMessage[] = [];

  for (const msg of sdkMessages) {
    if (msg.parent_tool_use_id !== null) continue;

    const msgObj = msg.message as Record<string, unknown> | undefined;
    if (!msgObj) continue;

    const role = msg.type === 'user' ? 'user' as const : 'assistant' as const;
    const content = msgObj.content;

    if (typeof content === 'string') {
      results.push({ role, content, timestamp: Date.now() });
      continue;
    }

    if (!Array.isArray(content)) continue;

    const blocks = content as Array<Record<string, unknown>>;
    const textParts: string[] = [];
    const items: NonNullable<ChatMessage['items']> = [];

    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
        items.push({ type: 'text', content: block.text });
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        items.push({
          type: 'tool',
          content: '',
          toolCall: {
            id: String(block.id || ''),
            name: String(block.name || ''),
            input: (block.input || {}) as Record<string, unknown>,
            status: 'complete' as const,
            result: '',
          },
        });
      } else if (block.type === 'tool_result') {
        const toolUseId = String(block.tool_use_id || '');
        let resultText = '';
        if (typeof block.content === 'string') {
          resultText = block.content;
        } else if (Array.isArray(block.content)) {
          resultText = (block.content as Array<Record<string, unknown>>)
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text as string)
            .join('\n');
        }
        for (const item of items) {
          if (item.type === 'tool' && item.toolCall?.id === toolUseId) {
            item.toolCall.result = resultText;
            break;
          }
        }
      }
    }

    const combinedText = textParts.join('\n');
    const hasToolCalls = items.some((it) => it.type === 'tool');

    results.push({
      role,
      content: combinedText,
      items: hasToolCalls ? items : undefined,
      timestamp: Date.now(),
    });
  }

  return results;
}

export function registerSessionHandlers(context: MainProcessContext): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async (): Promise<SessionMeta[]> => {
    const service = context.getAgentServiceOrThrow();
    const storage = context.getSessionStorageOrThrow();

    const sdkSessions = await service.listSessions();

    return sdkSessions
      .filter((s) => !storage.isSessionDeleted(s.sessionId))
      .map((s) => {
        const title = storage.getSessionTitle(s.sessionId) || s.customTitle || s.summary || '新对话';
        const preview = s.firstPrompt
          ? s.firstPrompt.slice(0, 120).replace(/\n/g, ' ')
          : (s.summary || '');
        return {
          id: s.sessionId,
          title,
          messageCount: 0,
          createdAt: s.lastModified,
          updatedAt: s.lastModified,
          preview,
        };
      });
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_event, id: string): Promise<Session | null> => {
    const service = context.getAgentServiceOrThrow();
    const storage = context.getSessionStorageOrThrow();

    const sdkSessions = await service.listSessions();
    const session = sdkSessions.find((s) => s.sessionId === id);
    if (!session) return null;

    const messages = await loadSessionMessages(context, session.sessionId);

    return {
      id: session.sessionId,
      title: storage.getSessionTitle(session.sessionId) || session.customTitle || session.summary || '新对话',
      messages,
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

    service.abort();

    const sdkSessions = await service.listSessions();
    const session = sdkSessions.find((s) => s.sessionId === id);
    if (!session) return null;

    service.setCurrentSessionId(session.sessionId);

    const messages = await loadSessionMessages(context, session.sessionId);

    return {
      id: session.sessionId,
      title: storage.getSessionTitle(session.sessionId) || session.customTitle || session.summary || '新对话',
      messages,
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
