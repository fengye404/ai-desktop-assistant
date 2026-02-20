# AI Desktop Assistant

A cross-platform AI desktop assistant built with Electron and TypeScript, supporting Claude API and OpenAI-compatible APIs with secure storage and streaming responses.

## Features

- **Dual API Support**: Claude API and OpenAI-compatible API
- **Wide Compatibility**: Works with OpenAI, Ollama, DeepSeek, Moonshot, Zhipu AI, and any OpenAI-compatible service
- **Secure Storage**: API keys are encrypted using Electron's `safeStorage` API
- **Streaming Responses**: Real-time display of AI-generated content
- **Stream Cancellation**: Cancel ongoing responses with a single click
- **Modern UI**: Glassmorphism design with smooth animations
- **Cross-Platform**: macOS and Windows support

## Supported API Types

### Claude API
Use for Anthropic Claude API or any Claude-compatible endpoint.

| Provider | Default Model | Base URL |
|----------|---------------|----------|
| Anthropic | claude-opus-4-6 | (leave empty or custom) |

### OpenAI Compatible API
Use for any OpenAI-compatible service:

| Provider | Model | Base URL |
|----------|-------|----------|
| OpenAI | gpt-4o | (leave empty) |
| Ollama (Local) | llama3.2 | http://localhost:11434/v1 |
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1 |
| Moonshot (Kimi) | moonshot-v1-8k | https://api.moonshot.cn/v1 |
| Zhipu AI (智谱) | glm-4 | https://open.bigmodel.cn/api/paas/v4 |

## Installation

```bash
# Install dependencies
npm install

# Build and run
npm start
```

## Configuration

1. Click the **Settings** button in the top-right corner
2. Configure:
   - **API Type**: Claude API or OpenAI Compatible API
   - **Model**: Model name (e.g., claude-opus-4-6, gpt-4o, deepseek-chat)
   - **API Key**: Your API key (encrypted and stored securely)
   - **Base URL**: Custom API endpoint (optional for OpenAI, required for others)
3. Click **Save Configuration**
4. Click **Test Connection** to verify

### Security Note
API keys are encrypted using Electron's `safeStorage` API:
- **macOS**: Uses Keychain Access
- **Windows**: Uses DPAPI (Data Protection API)
- **Linux**: Uses Secret Service (e.g., GNOME Keyring), falls back to plain text if unavailable

## Building for Distribution

```bash
# Build for current platform
npm run dist

# Build for macOS
npm run dist:mac

# Build for Windows
npm run dist:win
```

Output files will be in the `release/` directory.

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

## Examples

### Claude API
```
API Type: Claude API
Model: claude-opus-4-6
API Key: your-anthropic-key
Base URL: (leave empty or custom endpoint)
```

### Ollama (Local)
```
API Type: OpenAI Compatible API
Model: llama3.2
API Key: ollama (any value works)
Base URL: http://localhost:11434/v1
```

### DeepSeek
```
API Type: OpenAI Compatible API
Model: deepseek-chat
API Key: your-deepseek-key
Base URL: https://api.deepseek.com/v1
```

### Zhipu AI (智谱)
```
API Type: OpenAI Compatible API
Model: glm-4
API Key: your-zhipu-key
Base URL: https://open.bigmodel.cn/api/paas/v4
```

## Documentation

See `docs/overview.md` for detailed architecture documentation.

## License

MIT
