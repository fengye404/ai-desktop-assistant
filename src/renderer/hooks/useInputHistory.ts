import { useRef, useCallback } from 'react';

const MAX_HISTORY_LENGTH = 100;

export function useInputHistory() {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef<number | null>(null);
  const draftRef = useRef('');

  const navigate = useCallback((direction: 'prev' | 'next', currentInput: string): string | null => {
    const history = historyRef.current;
    if (history.length === 0) return null;

    const currentIndex = indexRef.current;

    if (direction === 'prev') {
      if (currentIndex === null) {
        draftRef.current = currentInput;
        indexRef.current = history.length - 1;
        return history[history.length - 1] ?? null;
      }
      if (currentIndex <= 0) {
        indexRef.current = 0;
        return history[0] ?? null;
      }
      indexRef.current = currentIndex - 1;
      return history[currentIndex - 1] ?? null;
    }

    if (currentIndex === null) return null;

    if (currentIndex >= history.length - 1) {
      indexRef.current = null;
      return draftRef.current;
    }

    indexRef.current = currentIndex + 1;
    return history[currentIndex + 1] ?? null;
  }, []);

  const push = useCallback((input: string) => {
    const history = historyRef.current;
    if (history.length === 0 || history[history.length - 1] !== input) {
      history.push(input);
      if (history.length > MAX_HISTORY_LENGTH) {
        history.shift();
      }
    }
    indexRef.current = null;
    draftRef.current = '';
  }, []);

  const resetNavigation = useCallback(() => {
    indexRef.current = null;
    draftRef.current = '';
  }, []);

  const isNavigating = indexRef.current !== null;

  return { navigate, push, resetNavigation, isNavigating, indexRef };
}
