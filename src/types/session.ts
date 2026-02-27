import type { ChatMessage } from './chat';

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}
