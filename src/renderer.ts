/// <reference path="./preload.ts" />

import type { ModelConfig, StreamChunk, PresetName, PresetsMap } from './types';

const PRESETS: PresetsMap = {
  anthropic: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    baseURL: '',
  },
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
  },
  ollama: {
    provider: 'openai',
    model: 'llama3.2',
    baseURL: 'http://localhost:11434/v1',
  },
  deepseek: {
    provider: 'openai',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
  },
  moonshot: {
    provider: 'openai',
    model: 'moonshot-v1-8k',
    baseURL: 'https://api.moonshot.cn/v1',
  },
  custom: {
    provider: 'openai',
    model: '',
    baseURL: '',
  },
};

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

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLElement).dataset.preset as PresetName;
        this.applyPreset(preset);
      });
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
    window.electronAPI.onStreamChunk((chunk) => {
      this.handleStreamChunk(chunk);
    });
  }

  private applyPreset(preset: PresetName): void {
    const config = PRESETS[preset];
    if (!config) return;

    // Update active state
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.preset === preset);
    });

    // Apply values
    if (config.provider) {
      this.providerSelect.value = config.provider;
    }
    if (config.model) {
      this.modelInput.value = config.model;
    }
    if (config.baseURL !== undefined) {
      this.baseURLInput.value = config.baseURL;
    }
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
            // If decryption fails, key might be corrupted or from different machine
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
      try {
        const encryptedKey = await window.electronAPI.encryptData(apiKey);
        localStorage.setItem(ENCRYPTED_API_KEY, encryptedKey);
      } catch (error) {
        console.error('Failed to encrypt API key:', error);
        // Fallback: show warning but still save
        this.addMessage('error', 'Warning: API key could not be encrypted. It will be stored in plain text.');
        // Store plain text as fallback (should not happen normally)
        const plainFallback = `plain:${apiKey}`;
        localStorage.setItem(ENCRYPTED_API_KEY, plainFallback);
      }
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

    // Check if configured
    if (!this.apiKeyInput.value) {
      this.addMessage('error', '请先在 Settings 中配置 API Key');
      return;
    }

    // Clear input
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';

    // Add user message
    this.addMessage('user', message);
    this.setLoading(true);

    // Reset current assistant message
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

  /**
   * Handle stream chunk from main process
   */
  private handleStreamChunk(chunk: StreamChunk): void {
    // Handle done signal
    if (chunk.type === 'done') {
      this.setLoading(false);
      return;
    }

    // Remove loading indicator
    const loadingEl = this.chatContainer.querySelector('.loading');
    if (loadingEl) loadingEl.remove();

    // Get or create assistant message
    if (!this.currentAssistantMessage) {
      this.currentAssistantMessage = document.createElement('div');
      this.currentAssistantMessage.className = 'message assistant';
      this.chatContainer.appendChild(this.currentAssistantMessage);
    }

    // Append content
    if (chunk.type === 'text') {
      const currentText = this.currentAssistantMessage.innerHTML || '';
      this.currentAssistantMessage.innerHTML = currentText + this.formatContent(chunk.content);
    } else if (chunk.type === 'error') {
      this.currentAssistantMessage.classList.add('error');
      this.currentAssistantMessage.textContent = chunk.content;
    }

    // Scroll to bottom
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  private addMessage(role: 'user' | 'assistant' | 'error', content: string): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = this.formatContent(content);
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  /**
   * Format content with enhanced markdown support
   */
  private formatContent(content: string): string {
    // Escape HTML entities first
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks with language identifier
    formatted = formatted.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) => {
        const language = lang || 'plaintext';
        return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
      }
    );

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Line breaks
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

  /**
   * Cancel the current stream
   */
  private async cancelStream(): Promise<void> {
    await window.electronAPI.abortStream();
    this.setLoading(false);
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
