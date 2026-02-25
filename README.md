# OpenCode ↔ Lark 桥接工具

**OpenCode-Lark Bridge**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

连接 Lark (飞书) 与 OpenCode AI 开发环境的桥接工具。通过 WebSocket 实时接收飞书消息，转发至 OpenCode 处理后将响应返回飞书。

[English Version](./README_EN.md)

---

## 功能特性

- **双向消息转发**: 自动将飞书消息转发到 OpenCode
- **WebSocket 长连接**: 使用飞书 SDK 实时接收消息
- **OpenCode 进程管理**: 自动启动和停止服务
- **Web 管理界面**: 可视化配置和状态监控
- **消息队列**: 支持消息缓冲，确保不丢失

---

## 安装

```bash
# 全局安装
npm install -g opencode-lark-bridge

# 或使用 npx
npx opencode-lark-bridge <command>
```

---

## CLI 命令

| 命令 | 说明 |
|------|------|
| `oclb start` | 启动桥接服务 |
| `oclb start --daemon` | 后台启动服务 |
| `oclb stop` | 停止桥接服务 |
| `oclb status` | 查看服务状态 |
| `oclb logs` | 查看日志 |
| `oclb logs -f` | 实时跟踪日志 |
| `oclb init` | 初始化配置文件 |
| `oclb --help` | 查看帮助 |

---

## 快速开始

```bash
# 初始化配置（交互式）
oclb init

# 启动服务
oclb start

# 或以后台模式启动
oclb start --daemon

# 访问 Web 界面
open http://localhost:3000
```

---

## 配置

| 配置项 | 说明 | 必填 | 示例 |
|--------|------|------|------|
| `feishuAppId` | 飞书应用 App ID | 是 | `cli_xxx` |
| `feishuAppSecret` | 飞书应用密钥 | 是 | `xxx` |
| `workDir` | OpenCode 工作目录，**配置将保存在此目录下** | 是 | `/path/to/workspace` |
| `bridgePort` | Web 服务端口 | 否 | `3000` |

> **重要变更**: 配置文件现在保存在 **工作目录** 下（`{workDir}/.config.json`），每个工作区拥有独立配置。

---

## 飞书应用设置

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. **创建应用** → **企业自建应用**
3. 添加 **机器人** 能力
4. 获取 **App ID** 和 **App Secret**
5. 添加权限: `im:chat:readonly`, `im:message:send`, `im:message:receive`
6. 发布应用

---

## 系统架构

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

**数据流向**:
1. 飞书 → WebSocket → Bridge → OpenCode
2. OpenCode → SSE/HTTP → Bridge → Lark API

---

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/status` | 获取桥接状态 |
| `GET` | `/api/config` | 获取配置 |
| `POST` | `/api/config` | 保存配置到**指定工作目录** |
| `POST` | `/api/start` | 启动桥接 |
| `POST` | `/api/stop` | 停止桥接 |

---

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Cannot connect to Lark | App ID/Secret 错误 | 检查凭证是否正确 |
| OpenCode process failed | opencode 未安装 | `npm install -g @anomaly/opencode` |
| Port already in use | 端口被占用 | 修改 `bridgePort` 配置 |
| Messages not forwarding | 权限不足 | 检查是否 @机器人 且已授予权限 |
| Config not saved to workDir | workDir 路径错误或权限不足 | 检查工作目录是否存在并有写入权限 |

---

## 许可证

[MIT License](LICENSE)

---

<p align="center">Made with ❤️ for the Lark and OpenCode community</p>
