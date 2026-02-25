# Feishu ↔ OpenCode Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A bridge tool connecting Feishu (Lark) messaging platform with OpenCode AI development environment. It receives Feishu messages in real-time via WebSocket, forwards them to OpenCode for processing, and sends responses back to Feishu.

[中文版](./README.md)

---

## Features

- **Bidirectional Message Forwarding**: Automatically forward Feishu messages to OpenCode
- **WebSocket Connection**: Real-time message reception using Feishu SDK
- **OpenCode Process Management**: Automatic service start/stop
- **Web Management UI**: Visual configuration and status monitoring
- **Message Queue**: Supports message buffering to prevent loss

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the service
npm start

# Open Web UI
open http://localhost:3000
```

---

## Configuration

| Config Item | Description | Required | Example |
|-------------|-------------|----------|---------|
| `feishuAppId` | Feishu App ID | Yes | `cli_xxx` |
| `feishuAppSecret` | Feishu App Secret | Yes | `xxx` |
| `workDir` | OpenCode workspace directory, **configuration will be saved here** | Yes | `/path/to/workspace` |
| `bridgePort` | Web service port | No | `3000` |
> **Important Change**: Configuration files are now saved in the **workspace directory** (`{workDir}/.config.json`), with independent configurations for each workspace.

---

## Feishu App Setup

1. Login to [Feishu Open Platform](https://open.feishu.cn/)
2. **Create App** → **Enterprise Self-built App**
3. Add **Bot** capability
4. Get **App ID** and **App Secret**
5. Add permissions: `im:chat:readonly`, `im:message:send`, `im:message:receive`
6. Publish the app

---

## System Architecture

```
┌─────────────────┐      WebSocket       ┌──────────────────┐      HTTP/SSE       ┌─────────────────┐
│   Feishu App    │ ◄──────────────────► │  Bridge Server   │ ◄──────────────────► │   OpenCode      │
└─────────────────┘                      └──────────────────┘                      └─────────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │   Web UI (3000)  │
                                         └──────────────────┘
```

**Data Flow**:
1. Feishu → WebSocket → Bridge → OpenCode
2. OpenCode → SSE/HTTP → Bridge → Feishu API

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
| Cannot connect to Feishu | Wrong App ID/Secret | Check credentials |
| OpenCode process failed | opencode not installed | `npm install -g @anomaly/opencode` |
| Port already in use | Port occupied | Modify `bridgePort` config |
| Messages not forwarding | Insufficient permissions | Check if @bot and permissions granted |
| Config not saved to workDir | Incorrect workDir path or insufficient permissions | Check if workspace directory exists and has write permissions |

---

## Contributing

Contributions are welcome!

```bash
# Fork and clone
# Create branch
git checkout -b feature/your-feature
# Commit changes
git commit -m 'Add feature'
# Push and submit PR
git push origin feature/your-feature
```

---

## License

[MIT License](LICENSE)

---

<p align="center">Made with ❤️ for the Feishu and OpenCode community</p>
