import { useCallback } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useSessionStore } from '@/stores/session-store';
import { electronApiClient } from '@/services/electron-api-client';

export function useAppActions() {
  const resetStreamState = useChatStore((s) => s.resetStreamState);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  const beforeSessionChange = useCallback(async () => {
    await electronApiClient.abortStream();
    resetStreamState();
  }, [resetStreamState]);

  const createSession = useCallback(async () => {
    await beforeSessionChange();
    const session = await electronApiClient.sessionCreate();
    useSessionStore.getState().applySessionSwitch(session.id, []);
    await loadSessions();
  }, [beforeSessionChange, loadSessions]);

  const switchSession = useCallback(async (id: string) => {
    if (id === useSessionStore.getState().currentSessionId) return;
    await beforeSessionChange();
    const session = await electronApiClient.sessionSwitch(id);
    if (!session) return;
    useSessionStore.getState().applySessionSwitch(session.id, session.messages);
    await loadSessions();
  }, [beforeSessionChange, loadSessions]);

  return { beforeSessionChange, createSession, switchSession };
}
