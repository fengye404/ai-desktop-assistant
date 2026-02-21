# AI Desktop Assistant

[简体中文](./README.zh-CN.md) | English

![Version](https://img.shields.io/badge/version-1.2.0-4c1)
![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-6b7280)

An AI desktop assistant built with Electron + React + TypeScript.

## Tags

![AI Assistant](https://img.shields.io/badge/-AI%20Assistant-111827?style=flat-square)
![Desktop App](https://img.shields.io/badge/-Desktop%20App-111827?style=flat-square)
![Agent Tools](https://img.shields.io/badge/-Agent%20Tools-111827?style=flat-square)
![Streaming](https://img.shields.io/badge/-Streaming-111827?style=flat-square)
![Multi Provider](https://img.shields.io/badge/-Multi%20Provider-111827?style=flat-square)

## Highlights

- Multi-provider model access (Anthropic and OpenAI-compatible endpoints)
- Streaming response rendering with tool-call visibility
- Local session storage and secure API key persistence
- Desktop-native workflow with Electron IPC architecture

## Tech Stack

- Electron 28
- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Zustand
- better-sqlite3

## Quick Start

```bash
npm install
npm start
```

## Configuration

Configure your provider and API key in **Settings**:

- Provider: Anthropic or OpenAI-compatible API
- Model: e.g. `claude-opus-4-6`, `gpt-4o`, `deepseek-chat`
- API Key: encrypted with Electron `safeStorage`
- Base URL: optional for custom compatible endpoints

## Scripts

```bash
npm run build         # Build main + renderer
npm run dev           # Dev mode
npm run lint          # Lint
npm run test:chat-stream
npm run dist          # Package app
```

## Documentation

- [Docs Home](./docs/README.md)
- [Architecture](./docs/architecture/README.md)
- [Guides](./docs/guides/README.md)

## License

MIT
