import { app } from 'electron';
import * as path from 'path';
import * as zlib from 'zlib';
import Database from 'better-sqlite3';
import type { Session, SessionMeta, ChatMessage, ModelConfig, MessageItem } from './types';

/**
 * Compress data using gzip
 */
function compressData(data: string): Buffer {
  return zlib.gzipSync(Buffer.from(data, 'utf-8'));
}

/**
 * Decompress gzip data
 */
function decompressData(data: Buffer): string {
  return zlib.gunzipSync(data).toString('utf-8');
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate session title from first message or default
 */
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim();
    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  }
  return '新对话';
}

/**
 * Session storage service using SQLite
 */
export class SessionStorage {
  private db: Database.Database;
  private currentSessionId: string | null = null;

  constructor() {
    // Store database in user data directory
    const dbPath = path.join(app.getPath('userData'), 'sessions.db');
    this.db = new Database(dbPath);

    this.initDatabase();
  }

  /**
   * Initialize database schema
   */
  private initDatabase(): void {
    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create messages table with compressed items support
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        items_data BLOB,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Migration: Add items_data column if not exists
    try {
      this.db.exec(`ALTER TABLE messages ADD COLUMN items_data BLOB`);
    } catch {
      // Column already exists
    }

    // Create config table for storing model configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
    `);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  // ==================== Config Methods ====================

  /**
   * Save model configuration
   */
  saveConfig(config: Partial<ModelConfig>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      if (config.provider !== undefined) {
        stmt.run('provider', config.provider);
      }
      if (config.model !== undefined) {
        stmt.run('model', config.model);
      }
      if (config.baseURL !== undefined) {
        stmt.run('baseURL', config.baseURL);
      }
      if (config.apiKey !== undefined) {
        // Store encrypted API key
        stmt.run('apiKey', config.apiKey);
      }
    });

    transaction();
  }

  /**
   * Load model configuration
   */
  loadConfig(): Partial<ModelConfig> {
    const stmt = this.db.prepare('SELECT key, value FROM config');
    const rows = stmt.all() as Array<{ key: string; value: string }>;

    const config: Partial<ModelConfig> = {};
    for (const row of rows) {
      if (row.key === 'provider') {
        config.provider = row.value as 'anthropic' | 'openai';
      } else if (row.key === 'model') {
        config.model = row.value;
      } else if (row.key === 'baseURL') {
        config.baseURL = row.value;
      } else if (row.key === 'apiKey') {
        config.apiKey = row.value;
      }
    }

    return config;
  }

  // ==================== Session Methods ====================

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get list of all sessions (metadata only)
   */
  listSessions(): SessionMeta[] {
    const stmt = this.db.prepare(`
      SELECT 
        s.id,
        s.title,
        s.created_at as createdAt,
        s.updated_at as updatedAt,
        COUNT(m.id) as messageCount,
        (SELECT content FROM messages WHERE session_id = s.id AND role = 'assistant' ORDER BY timestamp DESC LIMIT 1) as lastAssistantContent
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `);

    const rows = stmt.all() as Array<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
      messageCount: number;
      lastAssistantContent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      messageCount: row.messageCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      preview: row.lastAssistantContent
        ? row.lastAssistantContent.length > 50
          ? row.lastAssistantContent.substring(0, 50) + '...'
          : row.lastAssistantContent
        : '',
    }));
  }

  /**
   * Get messages for a session
   */
  private getSessionMessages(sessionId: string): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT role, content, items_data, timestamp
      FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId) as Array<{
      role: string;
      content: string;
      items_data: Buffer | null;
      timestamp: number;
    }>;

    return rows.map(row => {
      const msg: ChatMessage = {
        role: row.role as 'user' | 'assistant',
        content: row.content,
        timestamp: row.timestamp,
      };

      // Decompress items if exists
      if (row.items_data) {
        try {
          const itemsJson = decompressData(row.items_data);
          msg.items = JSON.parse(itemsJson) as MessageItem[];
        } catch (e) {
          console.error('Failed to decompress message items:', e);
        }
      }

      return msg;
    });
  }

  /**
   * Get a specific session by ID
   */
  getSession(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(id) as { id: string; title: string; createdAt: number; updatedAt: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      messages: this.getSessionMessages(id),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    if (!this.currentSessionId) return null;
    return this.getSession(this.currentSessionId);
  }

  /**
   * Create a new session
   */
  createSession(title?: string): Session {
    const now = Date.now();
    const id = generateSessionId();
    const sessionTitle = title || '新对话';

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, sessionTitle, now, now);
    this.currentSessionId = id;

    return {
      id,
      title: sessionTitle,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    // Delete messages first (or rely on CASCADE)
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);

    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }

    return result.changes > 0;
  }

  /**
   * Switch to a session
   */
  switchSession(id: string): Session | null {
    const session = this.getSession(id);
    if (session) {
      this.currentSessionId = id;
      return session;
    }
    return null;
  }

  /**
   * Rename a session
   */
  renameSession(id: string, title: string): boolean {
    const now = Date.now();
    const result = this.db
      .prepare(
        `
      UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?
    `
      )
      .run(title, now, id);

    return result.changes > 0;
  }

  /**
   * Update current session messages
   */
  updateMessages(messages: ChatMessage[]): void {
    if (!this.currentSessionId) {
      this.createSession();
    }

    const sessionId = this.currentSessionId!;

    // Use transaction for better performance
    const transaction = this.db.transaction(() => {
      // Clear existing messages
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);

      // Insert new messages with compressed items
      const insertStmt = this.db.prepare(`
        INSERT INTO messages (session_id, role, content, items_data, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        let itemsData: Buffer | null = null;
        
        // Compress items if exists
        if (msg.items && msg.items.length > 0) {
          try {
            const itemsJson = JSON.stringify(msg.items);
            itemsData = compressData(itemsJson);
          } catch (e) {
            console.error('Failed to compress message items:', e);
          }
        }

        insertStmt.run(
          sessionId, 
          msg.role, 
          msg.content, 
          itemsData,
          msg.timestamp || Date.now()
        );
      }

      // Update session timestamp and title
      const session = this.getSession(sessionId);
      let newTitle = session?.title || '新对话';

      if (newTitle === '新对话' && messages.length > 0) {
        newTitle = generateTitle(messages);
      }

      this.db
        .prepare(
          `
        UPDATE sessions SET updated_at = ?, title = ? WHERE id = ?
      `
        )
        .run(Date.now(), newTitle, sessionId);
    });

    transaction();
  }

  /**
   * Get messages for current session
   */
  getMessages(): ChatMessage[] {
    if (!this.currentSessionId) return [];
    return this.getSessionMessages(this.currentSessionId);
  }

  /**
   * Clear messages in current session
   */
  clearMessages(): void {
    if (this.currentSessionId) {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(this.currentSessionId);
      this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), this.currentSessionId);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
