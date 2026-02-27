# AI Desktop Assistant

[简体中文](./README.zh-CN.md) | English

![Version](https://img.shields.io/badge/version-2.0.0-4c1)
![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-6b7280)

An AI desktop assistant built on the **Claude Agent SDK**, with Electron + React + TypeScript.

## Highlights

- **Agent SDK-driven**: AI interaction, tool execution, and session management powered by Claude Agent SDK
- **Multi-provider**: Anthropic direct + OpenAI-compatible endpoints via protocol translation proxy
- **Streaming**: Real-time response rendering with tool call cards and inline approval
- **MCP support**: Dynamic tool extension via Stdio/SSE/HTTP transports
- **Secure storage**: API keys encrypted with Electron `safeStorage`
- **Modern UI**: React 19 + Tailwind CSS v4 + Glassmorphism design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 28 |
| Language | TypeScript 5.3 |
| UI | React 19, Radix UI (shadcn), Tailwind CSS v4 |
| State | Zustand |
| AI | @anthropic-ai/claude-agent-sdk |
| Build | Vite 7 (renderer) + esbuild (main) |
| Database | SQLite (better-sqlite3) |
| Packaging | electron-builder |

## Quick Start

```bash
npm install
npm start
```

## Configuration

Configure your provider in **Settings**:

- Provider: Anthropic or OpenAI-compatible
- Model: e.g. `claude-sonnet-4-6`, `gpt-4o`, `deepseek-chat`
- API Key: encrypted with Electron `safeStorage`
- Base URL: required for OpenAI-compatible endpoints

## Scripts

```bash
npm run dev              # Dev mode (hot reload)
npm run build            # Build main + renderer
npm run lint             # Lint
npm run test:chat-stream # Run tests
npm run dist             # Package app
npm run dist:mac         # Package for macOS
npm run dist:win         # Package for Windows
```

## Documentation

- [Docs Home](./docs/README.md)
- [System Architecture](./docs/architecture/system-architecture.md)
- [Architecture](./docs/architecture/README.md)
- [Guides](./docs/guides/README.md)
- [API Reference](./docs/api/README.md)

## License

MIT
