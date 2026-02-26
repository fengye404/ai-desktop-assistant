/// <reference path="./preload.ts" />

// Types defined locally to avoid module import issues in browser
type Provider = 'anthropic' | 'openai';
type ChunkType =
  | 'text'
  | 'thinking'
  | 'error'
  | 'done'
  | 'tool_use'
  | 'tool_start'
  | 'tool_input_delta'
  | 'tool_result'
  | 'processing';
type MessageRole = 'user' | 'assistant';

interface ModelConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolInputDeltaInfo {
  id: string;
  name: string;
  delta: string;
  accumulated: string;
}

interface StreamChunk {
  type: ChunkType;
  content: string;
  toolUse?: ToolUseInfo;
  toolUseComplete?: boolean;
  toolInputDelta?: ToolInputDeltaInfo;
}

interface ToolApprovalRequest {
  tool: string;
  input: Record<string, unknown>;
  description: string;
}

interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// Storage keys (deprecated - now using SQLite)
// const STORAGE_KEY = 'modelConfig';
// const ENCRYPTED_API_KEY = 'encryptedApiKey';

class ChatApp {
  private chatContainer: HTMLElement;
  private messageInput: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private settingsPanel: HTMLElement;
  private settingsToggle: HTMLElement;
  private connectionStatus: HTMLElement;
  private connectionText: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private modelInput: HTMLInputElement;
  private apiKeyInput: HTMLInputElement;
  private baseURLInput: HTMLInputElement;
  private sessionList: HTMLElement;
  private newChatBtn: HTMLButtonElement;
  private isLoading = false;
  private currentAssistantMessage: HTMLElement | null = null;
  private currentSessionId: string | null = null;
  private streamingContent = ''; // Accumulate streaming content
  private toolApprovalDialog: HTMLElement | null = null;

  constructor() {
    this.chatContainer = document.getElementById('chatContainer')!;
    this.messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
    this.clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
    this.settingsPanel = document.getElementById('settingsPanel')!;
    this.settingsToggle = document.getElementById('settingsToggle')!;
    this.connectionStatus = document.getElementById('connectionStatus')!;
    this.connectionText = document.getElementById('connectionText')!;
    this.providerSelect = document.getElementById('provider') as HTMLSelectElement;
    this.modelInput = document.getElementById('model') as HTMLInputElement;
    this.apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    this.baseURLInput = document.getElementById('baseURL') as HTMLInputElement;
    this.sessionList = document.getElementById('sessionList')!;
    this.newChatBtn = document.getElementById('newChatBtn') as HTMLButtonElement;

    this.initEventListeners();
    this.loadConfig();
    this.loadSessionList();
    this.initToolApprovalHandler();
  }

  private initEventListeners(): void {
    // Settings toggle
    this.settingsToggle.addEventListener('click', () => {
      this.settingsPanel.classList.toggle('open');
    });

    // Provider change - set default model
    this.providerSelect.addEventListener('change', () => {
      const provider = this.providerSelect.value;
      if (provider === 'anthropic') {
        this.modelInput.placeholder = '例如: claude-opus-4-6, claude-sonnet-4-6';
        if (!this.modelInput.value) {
          this.modelInput.value = 'claude-opus-4-6';
        }
        this.baseURLInput.value = '';
      } else {
        this.modelInput.placeholder = '例如: gpt-4o, deepseek-chat, llama3.2';
        if (!this.modelInput.value) {
          this.modelInput.value = 'gpt-4o';
        }
      }
    });

    // Save config
    document.getElementById('saveConfig')!.addEventListener('click', () => {
      this.saveConfig();
    });

    // Test connection
    document.getElementById('testConnection')!.addEventListener('click', () => {
      this.testConnection();
    });

    // Send button
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Cancel button
    this.cancelBtn.addEventListener('click', () => this.cancelStream());

    // Clear button
    this.clearBtn.addEventListener('click', () => this.clearHistory());

    // New chat button
    this.newChatBtn.addEventListener('click', () => this.createNewSession());

    // Enter to send
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.messageInput.addEventListener('input', () => {
      this.messageInput.style.height = 'auto';
      this.messageInput.style.height = `${Math.min(this.messageInput.scrollHeight, 200)}px`;
    });

    // Stream chunks
    window.electronAPI.onStreamChunk((chunk: StreamChunk) => {
      this.handleStreamChunk(chunk);
    });
  }

  /**
   * Load config from SQLite storage
   */
  private async loadConfig(): Promise<void> {
    try {
      // Load config from SQLite via IPC
      const config = (await window.electronAPI.configLoad()) as Partial<ModelConfig>;

      if (config && Object.keys(config).length > 0) {
        this.providerSelect.value = config.provider || 'anthropic';
        this.modelInput.value = config.model || '';
        this.baseURLInput.value = config.baseURL || '';

        // Load and decrypt API key
        if (config.apiKey) {
          try {
            const decryptedKey = await window.electronAPI.decryptData(config.apiKey);
            this.apiKeyInput.value = decryptedKey;
          } catch {
            console.warn('Failed to decrypt API key');
          }
        }

        // Apply to backend
        if (config.provider && config.model) {
          await window.electronAPI.setModelConfig({
            provider: config.provider,
            model: config.model,
            baseURL: config.baseURL,
            apiKey: this.apiKeyInput.value,
          });
        }
        this.updateConnectionStatus(true, '已配置');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  /**
   * Save config to SQLite storage
   */
  private async saveConfig(): Promise<void> {
    try {
      const apiKey = this.apiKeyInput.value;

      // Encrypt API key before saving
      let encryptedKey = '';
      if (apiKey) {
        encryptedKey = await window.electronAPI.encryptData(apiKey);
      }

      const config: Partial<ModelConfig> = {
        provider: this.providerSelect.value as ModelConfig['provider'],
        model: this.modelInput.value,
        baseURL: this.baseURLInput.value || undefined,
        apiKey: encryptedKey,
      };

      // Save config to SQLite via IPC (legacy shim)
      await window.electronAPI.configSave(config as never);

      // Apply to backend with API key
      await window.electronAPI.setModelConfig({
        provider: config.provider,
        model: config.model,
        baseURL: config.baseURL,
        apiKey: apiKey,
      });

      this.updateConnectionStatus(true, '已保存');
      this.settingsPanel.classList.remove('open');
    } catch (error) {
      console.error('Save config error:', error);
      this.updateConnectionStatus(false, '保存失败');
    }
  }

  private async testConnection(): Promise<void> {
    try {
      this.updateConnectionStatus(false, '测试中...');

      const config: Partial<ModelConfig> = {
        provider: this.providerSelect.value as ModelConfig['provider'],
        model: this.modelInput.value,
        apiKey: this.apiKeyInput.value,
        baseURL: this.baseURLInput.value || undefined,
      };

      await window.electronAPI.setModelConfig(config);

      const result = await window.electronAPI.testConnection();
      this.updateConnectionStatus(result.success, result.success ? '连接成功' : result.message);
    } catch (error) {
      console.error('Test connection error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.updateConnectionStatus(false, `测试失败: ${errorMessage}`);
    }
  }

  private updateConnectionStatus(connected: boolean, text: string): void {
    this.connectionStatus.className = `connection-status ${connected ? 'connected' : ''}`;
    this.connectionText.textContent = text;
  }

  private async sendMessage(): Promise<void> {
    const message = this.messageInput.value.trim();
    if (!message || this.isLoading) return;

    if (!this.apiKeyInput.value) {
      this.addMessage('error', '请先在 Settings 中配置 API Key');
      return;
    }

    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';

    this.addMessage('user', message);
    this.setLoading(true);

    this.currentAssistantMessage = null;
    this.streamingContent = ''; // Reset streaming content

    try {
      await window.electronAPI.sendMessageStream(message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      this.addMessage('error', `Error: ${errorMessage}`);
    } finally {
      this.setLoading(false);
    }
  }

  private handleStreamChunk(chunk: StreamChunk): void {
    if (chunk.type === 'done') {
      // Format the complete content when done
      if (this.currentAssistantMessage && this.streamingContent) {
        this.currentAssistantMessage.innerHTML = this.formatContent(this.streamingContent);
      }
      this.streamingContent = '';
      this.setLoading(false);
      // Refresh session list to update preview
      this.loadSessionList();
      return;
    }

    // Handle tool use notifications
    if (chunk.type === 'tool_use' && chunk.toolUse) {
      const inputStr = JSON.stringify(chunk.toolUse.input, null, 2);
      this.addToolMessage('use', chunk.toolUse.name, inputStr);
      return;
    }

    // Handle tool result notifications
    if (chunk.type === 'tool_result') {
      // Extract tool name from content (format: "Tool xxx completed/failed")
      const match = chunk.content.match(/Tool (\w+) (completed|failed)/);
      const toolName = match ? match[1] : 'unknown';
      this.addToolMessage('result', toolName, chunk.content);
      return;
    }

    const loadingEl = this.chatContainer.querySelector('.loading');
    if (loadingEl) loadingEl.remove();

    if (!this.currentAssistantMessage) {
      this.currentAssistantMessage = document.createElement('div');
      this.currentAssistantMessage.className = 'message assistant';
      this.chatContainer.appendChild(this.currentAssistantMessage);
    }

    if (chunk.type === 'text') {
      // Accumulate content and show plain text during streaming
      this.streamingContent += chunk.content;
      // Use textContent for faster updates during streaming
      this.currentAssistantMessage.textContent = this.streamingContent;
    } else if (chunk.type === 'error') {
      this.currentAssistantMessage.classList.add('error');
      this.currentAssistantMessage.textContent = chunk.content;
    }

    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  private addMessage(role: 'user' | 'assistant' | 'error', content: string): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = this.formatContent(content);
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  private formatContent(content: string): string {
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    formatted = formatted.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) => `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`
    );

    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;
    this.cancelBtn.style.display = loading ? 'block' : 'none';

    if (loading) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'message loading';
      loadingDiv.innerHTML = '<span></span><span></span><span></span>';
      this.chatContainer.appendChild(loadingDiv);
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    } else {
      const loadingEl = this.chatContainer.querySelector('.loading');
      if (loadingEl) loadingEl.remove();
    }
  }

  private async cancelStream(): Promise<void> {
    await window.electronAPI.abortStream();
    this.setLoading(false);
  }

  private async clearHistory(): Promise<void> {
    await window.electronAPI.clearHistory();
    // Clear the chat container and add welcome message
    this.chatContainer.innerHTML = '';
    this.addMessage('assistant', '对话已清除。有什么我可以帮你的吗？');
    // Refresh session list
    await this.loadSessionList();
  }

  /**
   * Load and render session list
   */
  private async loadSessionList(): Promise<void> {
    try {
      const sessions = await window.electronAPI.sessionList();
      this.renderSessionList(sessions);

      // Set current session ID if we have sessions
      if (sessions.length > 0 && !this.currentSessionId) {
        this.currentSessionId = sessions[0].id;
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  /**
   * Render session list in sidebar
   */
  private renderSessionList(sessions: SessionMeta[]): void {
    if (sessions.length === 0) {
      this.sessionList.innerHTML = '<div class="no-sessions">暂无对话记录</div>';
      return;
    }

    this.sessionList.innerHTML = sessions
      .map((session) => {
        const isActive = session.id === this.currentSessionId;
        const timeStr = this.formatTime(session.updatedAt);
        return `
          <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
            <div class="session-title">${this.escapeHtml(session.title)}</div>
            <div class="session-meta">
              <span class="session-preview">${this.escapeHtml(session.preview)}</span>
              <span class="session-time">${timeStr}</span>
            </div>
            <div class="session-actions">
              <button class="session-action-btn rename-btn" data-session-id="${session.id}">重命名</button>
              <button class="session-action-btn delete session-delete-btn" data-session-id="${session.id}">删除</button>
            </div>
          </div>
        `;
      })
      .join('');

    // Add event listeners
    this.sessionList.querySelectorAll('.session-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Ignore clicks on buttons
        if (target.classList.contains('session-action-btn')) return;

        const sessionId = (item as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.switchSession(sessionId);
        }
      });
    });

    this.sessionList.querySelectorAll('.session-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.deleteSession(sessionId);
        }
      });
    });

    this.sessionList.querySelectorAll('.rename-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.renameSession(sessionId);
        }
      });
    });
  }

  /**
   * Format timestamp to readable time
   */
  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create a new session
   */
  private async createNewSession(): Promise<void> {
    try {
      const session = await window.electronAPI.sessionCreate();
      this.currentSessionId = session.id;
      this.chatContainer.innerHTML = '';
      this.addMessage('assistant', '新对话已创建。有什么我可以帮你的吗？');
      await this.loadSessionList();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }

  /**
   * Switch to a different session
   */
  private async switchSession(sessionId: string): Promise<void> {
    if (sessionId === this.currentSessionId) return;

    try {
      const session = await window.electronAPI.sessionSwitch(sessionId);
      if (session) {
        this.currentSessionId = session.id;
        this.renderMessages(session.messages);
        await this.loadSessionList();
      }
    } catch (error) {
      console.error('Failed to switch session:', error);
    }
  }

  /**
   * Render messages from a session
   */
  private renderMessages(messages: ChatMessage[]): void {
    this.chatContainer.innerHTML = '';

    if (messages.length === 0) {
      this.addMessage('assistant', '有什么我可以帮你的吗？');
      return;
    }

    messages.forEach((msg) => {
      this.addMessage(msg.role, msg.content);
    });
  }

  /**
   * Delete a session
   */
  private async deleteSession(sessionId: string): Promise<void> {
    if (!confirm('确定要删除这个对话吗？')) return;

    try {
      await window.electronAPI.sessionDelete(sessionId);

      // If deleted current session, create new one
      if (sessionId === this.currentSessionId) {
        const sessions = await window.electronAPI.sessionList();
        if (sessions.length > 0) {
          await this.switchSession(sessions[0].id);
        } else {
          await this.createNewSession();
        }
      } else {
        await this.loadSessionList();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  /**
   * Rename a session
   */
  private async renameSession(sessionId: string): Promise<void> {
    const newTitle = prompt('输入新的对话标题：');
    if (!newTitle) return;

    try {
      await window.electronAPI.sessionRename(sessionId, newTitle);
      await this.loadSessionList();
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  }

  /**
   * Initialize tool approval handler
   */
  private initToolApprovalHandler(): void {
    window.electronAPI.onToolApprovalRequest((request: ToolApprovalRequest) => {
      this.showToolApprovalDialog(request);
    });
  }

  /**
   * Show tool approval dialog
   */
  private showToolApprovalDialog(request: ToolApprovalRequest): void {
    // Remove existing dialog
    if (this.toolApprovalDialog) {
      this.toolApprovalDialog.remove();
    }

    // Format input for display
    const inputDisplay = Object.entries(request.input)
      .map(([key, value]) => `<div class="tool-input-item"><strong>${key}:</strong> ${JSON.stringify(value)}</div>`)
      .join('');

    // Create dialog
    this.toolApprovalDialog = document.createElement('div');
    this.toolApprovalDialog.className = 'tool-approval-dialog';
    this.toolApprovalDialog.innerHTML = `
      <div class="tool-approval-content">
        <div class="tool-approval-header">
          <span class="tool-icon">🔧</span>
          <h3>工具权限请求</h3>
        </div>
        <div class="tool-approval-body">
          <div class="tool-name">
            <strong>工具名称：</strong> ${this.escapeHtml(request.tool)}
          </div>
          <div class="tool-inputs">
            <strong>参数：</strong>
            ${inputDisplay}
          </div>
        </div>
        <div class="tool-approval-actions">
          <button class="tool-btn deny">拒绝</button>
          <button class="tool-btn approve">允许</button>
        </div>
      </div>
    `;

    // Add event listeners
    const approveBtn = this.toolApprovalDialog.querySelector('.approve');
    const denyBtn = this.toolApprovalDialog.querySelector('.deny');

    approveBtn?.addEventListener('click', () => {
      window.electronAPI.respondToolApproval({ approved: true });
      this.hideToolApprovalDialog();
    });

    denyBtn?.addEventListener('click', () => {
      window.electronAPI.respondToolApproval({ approved: false });
      this.hideToolApprovalDialog();
    });

    document.body.appendChild(this.toolApprovalDialog);
  }

  /**
   * Hide tool approval dialog
   */
  private hideToolApprovalDialog(): void {
    if (this.toolApprovalDialog) {
      this.toolApprovalDialog.remove();
      this.toolApprovalDialog = null;
    }
  }

  /**
   * Add tool use message to chat
   */
  private addToolMessage(type: 'use' | 'result', toolName: string, content: string): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message tool-message tool-${type}`;

    const icon = type === 'use' ? '🔧' : '✅';
    const label = type === 'use' ? '调用工具' : '工具结果';

    messageDiv.innerHTML = `
      <div class="tool-message-header">
        <span class="tool-message-icon">${icon}</span>
        <span class="tool-message-label">${label}: ${this.escapeHtml(toolName)}</span>
      </div>
      <div class="tool-message-content">${this.escapeHtml(content)}</div>
    `;

    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
