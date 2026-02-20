# AI Desktop Assistant

A cross-platform AI desktop assistant built with Electron and TypeScript, supporting multiple AI providers with secure storage and streaming responses.

## Features

- **Multi-Provider Support**: Anthropic Claude, OpenAI, Ollama, DeepSeek, Moonshot, and any OpenAI-compatible API
- **Secure Storage**: API keys are encrypted using Electron's `safeStorage` API
- **Streaming Responses**: Real-time display of AI-generated content
- **Stream Cancellation**: Cancel ongoing responses with a single click
- **Markdown Support**: Enhanced formatting with code blocks and links
- **Cross-Platform**: macOS and Windows support

## Supported Providers

### Built-in Presets
| Provider | Default Model | Base URL |
|----------|---------------|----------|
| Anthropic Claude | claude-opus-4-6 | - |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| Ollama (Local) | llama3.2 | http://localhost:11434/v1 |
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1 |
| Moonshot | moonshot-v1-8k | https://api.moonshot.cn/v1 |
| Custom | (user-defined) | (user-defined) |

### Custom Endpoints
Supports any OpenAI-compatible API endpoint:
- vLLM
- LM Studio
- LocalAI
- Other OpenAI-compatible services

## Installation

```bash
# Install dependencies
npm install

# Build and run
npm start

# Development mode with watch
npm run dev
```

## Configuration

1. Click the **Settings** button in the top-right corner
2. Select a preset or configure manually:
   - **Provider**: Anthropic or OpenAI Compatible
   - **Model**: Model name (e.g., gpt-4o, claude-opus-4-6)
   - **API Key**: Your API key (encrypted and stored securely)
   - **Base URL**: Custom API endpoint (optional)
3. Click **Save Configuration**

### Security Note
API keys are encrypted using Electron's `safeStorage` API:
- **macOS**: Uses Keychain Access
- **Windows**: Uses DPAPI (Data Protection API)
- **Linux**: Requires a secret service (e.g., GNOME Keyring)

## Building for Distribution

```bash
# Build for current platform
npm run dist

# Build for macOS
npm run dist:mac

# Build for Windows
npm run dist:win
```

Output files will be in the `release/` directory:
- **macOS**: `.dmg` and `.zip` for both Intel (x64) and Apple Silicon (arm64)
- **Windows**: `.exe` installer and portable version

## Development

### Project Structure

```
ai-desktop-assistant/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Context bridge for IPC
│   ├── renderer.ts          # Frontend logic
│   ├── claude-service.ts    # Multi-provider AI service
│   ├── types/
│   │   └── index.ts         # Centralized type definitions
│   └── utils/
│       └── errors.ts        # Custom error classes
├── public/
│   └── index.html           # UI template (CSS included)
├── docs/
│   └── overview.md          # Architecture documentation
├── dist/                    # Compiled JavaScript
├── release/                 # Built installers
├── package.json
├── tsconfig.json
├── electron-builder.yml     # Packaging configuration
├── .eslintrc.json           # ESLint configuration
└── .prettierrc              # Prettier configuration
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm start` | Build and run the app |
| `npm run dev` | Development mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run dist` | Build installers |

### IPC Communication

| Channel | Direction | Description |
|---------|-----------|-------------|
| `send-message` | Renderer → Main | Send message, get complete response |
| `send-message-stream` | Renderer → Main | Send message, receive stream |
| `abort-stream` | Renderer → Main | Cancel current stream |
| `set-model-config` | Renderer → Main | Update AI provider config |
| `test-connection` | Renderer → Main | Test API connectivity |
| `encrypt-data` | Renderer → Main | Encrypt sensitive data |
| `decrypt-data` | Renderer → Main | Decrypt sensitive data |
| `stream-chunk` | Main → Renderer | Stream response chunk |

## Examples

### Ollama (Local)
```
Provider: OpenAI Compatible
Model: llama3.2
API Key: ollama (any value works)
Base URL: http://localhost:11434/v1
```

### DeepSeek
```
Provider: OpenAI Compatible
Model: deepseek-chat
API Key: your-deepseek-api-key
Base URL: https://api.deepseek.com/v1
```

### Moonshot (Kimi)
```
Provider: OpenAI Compatible
Model: moonshot-v1-8k
API Key: your-moonshot-api-key
Base URL: https://api.moonshot.cn/v1
```

## Documentation

See `docs/overview.md` for detailed architecture documentation.

## License

MIT
