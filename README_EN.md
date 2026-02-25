# OpenCode ↔ Lark Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A bridge tool connecting Lark (Feishu) messaging platform with OpenCode AI development environment. It receives Lark messages in real-time via WebSocket, forwards them to OpenCode for processing, and sends responses back to Lark.

[中文版](./README.md)

---

## Features

- **Bidirectional Message Forwarding**: Automatically forward Lark messages to OpenCode
- **WebSocket Connection**: Real-time message reception using Lark SDK
- **OpenCode Process Management**: Automatic service start/stop
- **Web Management UI**: Visual configuration and status monitoring
- **Message Queue**: Supports message buffering to prevent loss

---

## Installation

```bash
# Install globally
npm install -g opencode-lark-bridge

# Or use npx
npx opencode-lark-bridge <command>
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `oclb start` | Start the bridge service |
| `oclb start --daemon` | Start service in background |
| `oclb stop` | Stop the bridge service |
| `oclb status` | Check service status |
| `oclb logs` | View logs |
| `oclb logs -f` | Follow logs in real-time |
| `oclb init` | Initialize configuration |
| `oclb --help` | Show help |

---

## Quick Start

```bash
# Initialize configuration (interactive)
oclb init

# Start the service
oclb start

# Or start in daemon mode
oclb start --daemon

# Open Web UI
open http://localhost:3000
```

---

## Configuration

| Config Item | Description | Required | Example |
|-------------|-------------|----------|---------|
| `feishuAppId` | Lark App ID | Yes | `cli_xxx` |
| `feishuAppSecret` | Lark App Secret | Yes | `xxx` |
| `workDir` | OpenCode workspace directory, **configuration will be saved here** | Yes | `/path/to/workspace` |
| `bridgePort` | Web service port | No | `3000` |

> **Important Change**: Configuration files are now saved in the **workspace directory** (`{workDir}/.config.json`), with independent configurations for each workspace.

---

## Lark App Setup

1. Login to [Lark Open Platform](https://open.feishu.cn/)
2. **Create App** → **Enterprise Self-built App**
3. Add **Bot** capability
4. Get **App ID** and **App Secret**
5. Add permissions: `im:chat:readonly`, `im:message:send`, `im:message:receive`
6. Publish the app

---

## System Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────────┐      HTTP/SSE       ┌─────────────────┐
│   Lark App      │ ◄──────────────────► │  Bridge Server   │ ◄──────────────────► │   OpenCode      │
└─────────────────┘                      └──────────────────┘                      └─────────────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │   Web UI (3000)  │
                                     └──────────────────┘
```

**Data Flow**:
1. Lark → WebSocket → Bridge → OpenCode
2. OpenCode → SSE/HTTP → Bridge → Lark API

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Get bridge status |
| `GET` | `/api/config` | Get configuration |
| `POST` | `/api/config` | Save configuration to **specified workspace directory** |
| `POST` | `/api/start` | Start bridge |
| `POST` | `/api/stop` | Stop bridge |

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Cannot connect to Lark | Wrong App ID/Secret | Check credentials |
| OpenCode process failed | opencode not installed | `npm install -g @anomaly/opencode` |
| Port already in use | Port occupied | Modify `bridgePort` config |
| Messages not forwarding | Insufficient permissions | Check if @bot and permissions granted |
| Config not saved to workDir | Incorrect workDir path or insufficient permissions | Check if workspace directory exists and has write permissions |

---

## License

[MIT License](LICENSE)

---

<p align="center">Made with ❤️ for the Lark and OpenCode community</p>
