import { app } from 'electron';
import * as path from 'path';
import * as zlib from 'zlib';
import Database from 'better-sqlite3';
import type {
  Session,
  SessionMeta,
  ChatMessage,
  ChatImageAttachment,
  ModelConfig,
  ModelServiceInstance,
  ModelServicesConfig,
  MessageItem,
  McpServersConfig,
  Provider,
} from './types';

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
    if (!content && firstUserMessage.attachments && firstUserMessage.attachments.length > 0) {
      return '图片对话';
    }
    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  }
  return '新对话';
}

const ACTIVE_MODEL_INSTANCE_ID_KEY = 'activeModelInstanceId';

function createModelInstanceId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultModel(provider: Provider): string {
  return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
}

function normalizeProvider(raw: string | undefined): Provider {
  return raw === 'anthropic' ? 'anthropic' : 'openai';
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
        attachments_data BLOB,
        items_data BLOB,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Migration: Add items_data column if not exists
    try {
      this.db.exec('ALTER TABLE messages ADD COLUMN items_data BLOB');
    } catch {
      // Column already exists
    }

    // Migration: Add attachments_data column if not exists
    try {
      this.db.exec('ALTER TABLE messages ADD COLUMN attachments_data BLOB');
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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS model_instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        base_url TEXT,
        api_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_model_instances_updated_at ON model_instances(updated_at DESC)
    `);

    this.migrateLegacySingleConfig();

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  // ==================== Config Methods ====================

  private migrateLegacySingleConfig(): void {
    const existingRow = this.db
      .prepare('SELECT COUNT(1) as count FROM model_instances')
      .get() as { count: number };

    if (existingRow.count > 0) {
      return;
    }

    const rows = this.db
      .prepare(
        `
          SELECT key, value
          FROM config
          WHERE key IN ('provider', 'model', 'baseURL', 'apiKey')
        `
      )
      .all() as Array<{ key: string; value: string }>;

    if (rows.length === 0) {
      return;
    }

    const legacyConfig: Partial<ModelConfig> = {};
    for (const row of rows) {
      if (row.key === 'provider') {
        legacyConfig.provider = normalizeProvider(row.value);
      } else if (row.key === 'model') {
        legacyConfig.model = row.value;
      } else if (row.key === 'baseURL') {
        legacyConfig.baseURL = row.value;
      } else if (row.key === 'apiKey') {
        legacyConfig.apiKey = row.value;
      }
    }

    const provider = normalizeProvider(legacyConfig.provider);
    const model = legacyConfig.model?.trim() || getDefaultModel(provider);
    const now = Date.now();
    const migratedInstanceId = createModelInstanceId();
    const migratedInstanceName = provider === 'anthropic' ? 'Anthropic 默认实例' : 'OpenAI 默认实例';
    const insertModelStmt = this.db.prepare(`
      INSERT INTO model_instances (
        id,
        name,
        provider,
        model,
        base_url,
        api_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const upsertConfigStmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertModelStmt.run(
        migratedInstanceId,
        migratedInstanceName,
        provider,
        model,
        legacyConfig.baseURL || null,
        legacyConfig.apiKey || '',
        now,
        now,
      );
      upsertConfigStmt.run(ACTIVE_MODEL_INSTANCE_ID_KEY, migratedInstanceId);
    });

    transaction();
  }

  /**
   * Save model instances configuration
   */
  saveModelServicesConfig(config: ModelServicesConfig): void {
    const now = Date.now();
    const normalizedInstances: ModelServiceInstance[] = [];

    for (const item of config.instances) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const model = typeof item.model === 'string' ? item.model.trim() : '';
      const provider = normalizeProvider(item.provider);
      if (!id || !name || !model) {
        continue;
      }

      normalizedInstances.push({
        id,
        name,
        provider,
        model,
        apiKey: typeof item.apiKey === 'string' ? item.apiKey : '',
        baseURL: typeof item.baseURL === 'string' && item.baseURL.trim()
          ? item.baseURL.trim()
          : undefined,
      });
    }

    if (normalizedInstances.length === 0) {
      const defaultProvider: Provider = 'anthropic';
      normalizedInstances.push({
        id: createModelInstanceId(),
        name: '默认实例',
        provider: defaultProvider,
        model: getDefaultModel(defaultProvider),
        apiKey: '',
      });
    }

    const nextIdSet = new Set(normalizedInstances.map((item) => item.id));
    const activeInstanceId = config.activeInstanceId && nextIdSet.has(config.activeInstanceId)
      ? config.activeInstanceId
      : normalizedInstances[0].id;

    const existingRows = this.db.prepare('SELECT id FROM model_instances').all() as Array<{ id: string }>;
    const upsertInstanceStmt = this.db.prepare(`
      INSERT INTO model_instances (
        id,
        name,
        provider,
        model,
        base_url,
        api_key,
        created_at,
        updated_at
      ) VALUES (@id, @name, @provider, @model, @baseURL, @apiKey, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        provider = excluded.provider,
        model = excluded.model,
        base_url = excluded.base_url,
        api_key = excluded.api_key,
        updated_at = excluded.updated_at
    `);
    const deleteInstanceStmt = this.db.prepare('DELETE FROM model_instances WHERE id = ?');
    const upsertConfigStmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const item of normalizedInstances) {
        upsertInstanceStmt.run({
          id: item.id,
          name: item.name,
          provider: item.provider,
          model: item.model,
          baseURL: item.baseURL ?? null,
          apiKey: item.apiKey,
          createdAt: now,
          updatedAt: now,
        });
      }

      for (const row of existingRows) {
        if (!nextIdSet.has(row.id)) {
          deleteInstanceStmt.run(row.id);
        }
      }

      upsertConfigStmt.run(ACTIVE_MODEL_INSTANCE_ID_KEY, activeInstanceId);
    });

    transaction();
  }

  /**
   * Load model instances configuration
   */
  loadModelServicesConfig(): ModelServicesConfig {
    const instances = this.db
      .prepare(
        `
          SELECT
            id,
            name,
            provider,
            model,
            base_url as baseURL,
            api_key as apiKey
          FROM model_instances
          ORDER BY updated_at DESC, created_at ASC
        `
      )
      .all() as Array<{
        id: string;
        name: string;
        provider: string;
        model: string;
        baseURL: string | null;
        apiKey: string | null;
      }>;

    const normalizedInstances: ModelServiceInstance[] = instances.map((item) => ({
      id: item.id,
      name: item.name,
      provider: normalizeProvider(item.provider),
      model: item.model,
      apiKey: item.apiKey || '',
      baseURL: item.baseURL || undefined,
    }));

    const activeIdRow = this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .get(ACTIVE_MODEL_INSTANCE_ID_KEY) as { value: string } | undefined;
    const activeInstanceId = activeIdRow?.value && normalizedInstances.some((item) => item.id === activeIdRow.value)
      ? activeIdRow.value
      : normalizedInstances[0]?.id ?? null;

    return {
      activeInstanceId,
      instances: normalizedInstances,
    };
  }

  /**
   * Backward-compatible single model configuration save
   */
  saveConfig(config: Partial<ModelConfig>): void {
    const current = this.loadModelServicesConfig();
    const activeInstance =
      current.instances.find((item) => item.id === current.activeInstanceId) ?? current.instances[0];

    if (!activeInstance) {
      const provider = normalizeProvider(config.provider);
      const baseURL = typeof config.baseURL === 'string' && config.baseURL.trim()
        ? config.baseURL.trim()
        : undefined;
      this.saveModelServicesConfig({
        activeInstanceId: null,
        instances: [
          {
            id: createModelInstanceId(),
            name: '默认实例',
            provider,
            model: config.model?.trim() || getDefaultModel(provider),
            apiKey: config.apiKey || '',
            baseURL,
          },
        ],
      });
      return;
    }

    const merged: ModelServiceInstance = {
      ...activeInstance,
      provider: config.provider ? normalizeProvider(config.provider) : activeInstance.provider,
      model: config.model?.trim() || activeInstance.model,
      apiKey: config.apiKey ?? activeInstance.apiKey,
      baseURL:
        config.baseURL === undefined
          ? activeInstance.baseURL
          : config.baseURL.trim()
            ? config.baseURL.trim()
            : undefined,
    };

    this.saveModelServicesConfig({
      activeInstanceId: merged.id,
      instances: current.instances.map((item) => (item.id === merged.id ? merged : item)),
    });
  }

  /**
   * Backward-compatible single model configuration load
   */
  loadConfig(): Partial<ModelConfig> {
    const current = this.loadModelServicesConfig();
    const activeInstance =
      current.instances.find((item) => item.id === current.activeInstanceId) ?? current.instances[0];

    if (!activeInstance) {
      return {};
    }

    return {
      provider: activeInstance.provider,
      model: activeInstance.model,
      baseURL: activeInstance.baseURL,
      apiKey: activeInstance.apiKey,
    };
  }

  /**
   * Save MCP servers configuration
   */
  saveMcpServers(config: McpServersConfig): void {
    const payload = JSON.stringify(config);
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
    `
      )
      .run('mcpServers', payload);
  }

  /**
   * Load MCP servers configuration
   */
  loadMcpServers(): McpServersConfig {
    const row = this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .get('mcpServers') as { value: string } | undefined;

    if (!row?.value) {
      return {};
    }

    try {
      const parsed = JSON.parse(row.value) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      return parsed as McpServersConfig;
    } catch {
      return {};
    }
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
      SELECT role, content, attachments_data, items_data, timestamp
      FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId) as Array<{
      role: string;
      content: string;
      attachments_data: Buffer | null;
      items_data: Buffer | null;
      timestamp: number;
    }>;

    return rows.map(row => {
      const msg: ChatMessage = {
        role: row.role as 'user' | 'assistant',
        content: row.content,
        timestamp: row.timestamp,
      };

      if (row.attachments_data) {
        try {
          const attachmentsJson = decompressData(row.attachments_data);
          msg.attachments = JSON.parse(attachmentsJson) as ChatImageAttachment[];
        } catch (e) {
          console.error('Failed to decompress message attachments:', e);
        }
      }

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
        INSERT INTO messages (session_id, role, content, attachments_data, items_data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        let attachmentsData: Buffer | null = null;
        let itemsData: Buffer | null = null;

        // Compress attachments if exists
        if (msg.attachments && msg.attachments.length > 0) {
          try {
            const attachmentsJson = JSON.stringify(msg.attachments);
            attachmentsData = compressData(attachmentsJson);
          } catch (e) {
            console.error('Failed to compress message attachments:', e);
          }
        }

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
          attachmentsData,
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
