export const DEFAULT_MAX_TOKENS = 4096;
export const MAX_HISTORY_LENGTH = 50;
export const MAX_TOOL_ITERATIONS = 10;
export const MAX_TOOL_RESULT_CONTENT_LENGTH = 12000;
export const ANTHROPIC_FINE_GRAINED_TOOL_STREAMING_BETA = 'fine-grained-tool-streaming-2025-05-14';

export const DEFAULT_ANTHROPIC_SYSTEM_PROMPT =
  'You are a helpful AI assistant. You have access to tools to help complete tasks.';
export const DEFAULT_OPENAI_SYSTEM_PROMPT = 'You are a helpful AI assistant.';
export const WAITING_FOR_AI_RESPONSE_MESSAGE = '等待 AI 响应...';

export function truncateToolResultContent(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CONTENT_LENGTH) {
    return content;
  }
  const truncated = content.slice(0, MAX_TOOL_RESULT_CONTENT_LENGTH);
  const omitted = content.length - MAX_TOOL_RESULT_CONTENT_LENGTH;
  return `${truncated}\n\n... (output truncated, omitted ${omitted} chars)`;
}
