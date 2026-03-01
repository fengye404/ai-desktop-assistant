import { useState, useEffect, useRef, useCallback } from 'react';

const THINKING_MESSAGES = [
  '思考中',
  '正在分析',
  '组织思路',
  '准备回答',
];

const TOOL_PROCESSING_MESSAGES = [
  '处理中',
  '执行操作',
  '等待结果',
  '继续处理',
];

const WAIT_TIME_HINT_THRESHOLD_SEC = 8;

type WaitStage = 'approval' | 'model' | null;

interface UseWaitingStateOptions {
  hasPendingApproval: boolean;
  isLoading: boolean;
  hasStreamText: boolean;
  hasStreamTool?: boolean;
  isWaitingResponse: boolean;
}

export function useWaitingState({
  hasPendingApproval,
  isLoading,
  hasStreamText,
  hasStreamTool = false,
  isWaitingResponse,
}: UseWaitingStateOptions) {
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const [waitElapsedSec, setWaitElapsedSec] = useState(0);
  const waitStartTimestampRef = useRef<number | null>(null);
  const hasAnyStreamOutput = hasStreamText || hasStreamTool;

  const shouldShowThinking = !hasPendingApproval && !hasAnyStreamOutput && (isLoading || isWaitingResponse);
  const shouldShowContinue = false;
  const activeWaitStage: WaitStage = hasPendingApproval
    ? 'approval'
    : (shouldShowThinking ? 'model' : null);
  const showWaitDurationHint = waitElapsedSec >= WAIT_TIME_HINT_THRESHOLD_SEC;

  const resetThinking = useCallback(() => {
    setThinkingText(THINKING_MESSAGES[0]);
  }, []);

  useEffect(() => {
    if (shouldShowThinking) {
      const messages = isWaitingResponse ? TOOL_PROCESSING_MESSAGES : THINKING_MESSAGES;
      const interval = setInterval(() => {
        setThinkingText(prev => {
          const currentIndex = messages.indexOf(prev);
          if (currentIndex === -1) return messages[0];
          return messages[(currentIndex + 1) % messages.length];
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [shouldShowThinking, isWaitingResponse]);

  useEffect(() => {
    if (!activeWaitStage) {
      waitStartTimestampRef.current = null;
      setWaitElapsedSec(0);
      return;
    }

    waitStartTimestampRef.current = Date.now();
    setWaitElapsedSec(0);

    const timer = setInterval(() => {
      if (!waitStartTimestampRef.current) return;
      setWaitElapsedSec(Math.floor((Date.now() - waitStartTimestampRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWaitStage]);

  return {
    thinkingText,
    waitElapsedSec,
    showWaitDurationHint,
    shouldShowThinking,
    shouldShowContinue,
    activeWaitStage,
    resetThinking,
  };
}
