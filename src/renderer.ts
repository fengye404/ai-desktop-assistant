/// <reference path="./preload.ts" />

// Types defined locally to avoid module import issues in browser
type Provider = 'anthropic' | 'openai';
type ChunkType = 'text' | 'thinking' | 'error' | 'done';

interface ModelConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

interface StreamChunk {
  type: ChunkType;
  content: string;
}

// Storage keys
const STORAGE_KEY = 'modelConfig';
const ENCRYPTED_API_KEY = 'encryptedApiKey';

class ChatApp {
  private chatContainer: HTMLElement;
  private messageInput: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private settingsPanel: HTMLElement;
  private settingsToggle: HTMLElement;
  private connectionStatus: HTMLElement;
  private connectionText: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private modelInput: HTMLInputElement;
  private apiKeyInput: HTMLInputElement;
  private baseURLInput: HTMLInputElement;
  private isLoading = false;
  private currentAssistantMessage: HTMLElement | null = null;

  constructor() {
    this.chatContainer = document.getElementById('chatContainer')!;
    this.messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
    this.settingsPanel = document.getElementById('settingsPanel')!;
    this.settingsToggle = document.getElementById('settingsToggle')!;
    this.connectionStatus = document.getElementById('connectionStatus')!;
    this.connectionText = document.getElementById('connectionText')!;
    this.providerSelect = document.getElementById('provider') as HTMLSelectElement;
    this.modelInput = document.getElementById('model') as HTMLInputElement;
    this.apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    this.baseURLInput = document.getElementById('baseURL') as HTMLInputElement;

    this.initEventListeners();
    this.loadConfig();
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
   * Load config from secure storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved) as Partial<ModelConfig>;

        this.providerSelect.value = config.provider || 'anthropic';
        this.modelInput.value = config.model || '';
        this.baseURLInput.value = config.baseURL || '';

        // Load encrypted API key
        const encryptedKey = localStorage.getItem(ENCRYPTED_API_KEY);
        if (encryptedKey) {
          try {
            const decryptedKey = await window.electronAPI.decryptData(encryptedKey);
            this.apiKeyInput.value = decryptedKey;
          } catch {
            console.warn('Failed to decrypt API key, clearing stored data');
            localStorage.removeItem(ENCRYPTED_API_KEY);
          }
        }

        // Apply to backend (without API key initially)
        if (config.provider && config.model) {
          await window.electronAPI.setModelConfig({
            provider: config.provider,
            model: config.model,
            baseURL: config.baseURL,
          });
        }
        this.updateConnectionStatus(true, '已配置');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  /**
   * Save config to secure storage
   */
  private async saveConfig(): Promise<void> {
    const config: Partial<ModelConfig> = {
      provider: this.providerSelect.value as ModelConfig['provider'],
      model: this.modelInput.value,
      baseURL: this.baseURLInput.value || undefined,
    };

    // Save non-sensitive config to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    // Encrypt and save API key
    const apiKey = this.apiKeyInput.value;
    if (apiKey) {
      const encryptedKey = await window.electronAPI.encryptData(apiKey);
      localStorage.setItem(ENCRYPTED_API_KEY, encryptedKey);
    } else {
      localStorage.removeItem(ENCRYPTED_API_KEY);
    }

    // Apply to backend with API key
    await window.electronAPI.setModelConfig({
      ...config,
      apiKey: apiKey,
    });

    this.updateConnectionStatus(true, '已保存');
    this.settingsPanel.classList.remove('open');
  }

  private async testConnection(): Promise<void> {
    this.updateConnectionStatus(false, '测试中...');

    const config: Partial<ModelConfig> = {
      provider: this.providerSelect.value as ModelConfig['provider'],
      model: this.modelInput.value,
      apiKey: this.apiKeyInput.value,
      baseURL: this.baseURLInput.value || undefined,
    };

    await window.electronAPI.setModelConfig(config);

    const result = await window.electronAPI.testConnection();
    this.updateConnectionStatus(result.success, result.success ? '连接成功' : '连接失败');
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
      this.setLoading(false);
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
      const currentText = this.currentAssistantMessage.innerHTML || '';
      this.currentAssistantMessage.innerHTML = currentText + this.formatContent(chunk.content);
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
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
