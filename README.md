# 飞书 ↔ OpenCode 桥接工具

**Feishu-OpenCode Bridge**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

一个用于连接飞书(Feishu/Lark)消息平台与 OpenCode AI 开发环境的桥接工具。通过 WebSocket 长连接实时接收飞书消息，并将其转发到 OpenCode 处理，再将响应返回至飞书。

---

## 目录

- [功能特性](#功能特性)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [安装](#安装)
- [配置](#配置)
- [飞书应用设置](#飞书应用设置)
- [使用说明](#使用说明)
- [架构](#架构)
- [API 参考](#api-参考)
- [故障排除](#故障排除)
- [贡献](#贡献)
- [许可证](#许可证)
- [致谢](#致谢)

---

## 功能特性

- **双向消息转发**: 自动将飞书消息转发到 OpenCode，并将 AI 响应返回至飞书
- **WebSocket 长连接**: 使用飞书官方 SDK 建立稳定的 WebSocket 连接，实时接收消息
- **OpenCode 进程管理**: 内置 OpenCode 服务进程管理，自动启动和停止
- **简洁的 Web 界面**: 提供美观的 Web UI 进行配置和状态监控
- **消息队列缓存**: 支持消息队列缓冲，确保消息不丢失

---

## 环境要求

在开始之前，请确保你的系统满足以下要求：

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 或 **yarn** >= 1.22.0
- **opencode CLI** 已安装 (`npm install -g @anomaly/opencode`)
- **飞书开发者账号**: 拥有创建企业自建应用的权限

---

## 快速开始

### 1. 克隆仓库并进入项目目录

```bash
cd feishu-opencode-bridge
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

### 4. 打开 Web 界面

在浏览器中访问: `http://localhost:3000`

### 5. 配置桥接

1. 在 Web 界面中填写 **飞书 App ID** 和 **App Secret**
2. 设置 **工作目录** (OpenCode 工作区路径)
3. 点击 **保存配置**
4. 点击 **启动桥接**

---

## 安装

### 使用 npm

```bash
# 安装依赖
npm install

# 生产模式启动
npm start

# 开发模式启动 (带热重载)
npm run dev
```

### 使用 Docker (可选)

```bash
# 构建镜像
docker build -t feishu-opencode-bridge .

# 运行容器
docker run -p 3000:3000 feishu-opencode-bridge
```

---

## 配置

### 配置项说明

| 配置项 | 说明 | 必填 | 示例 |
|--------|------|------|------|
| `feishuAppId` | 飞书应用的 App ID | 是 | `cli_xxx` |
| `feishuAppSecret` | 飞书应用的 App Secret | 是 | `xxx` |
| `workDir` | OpenCode 工作区目录 | 是 | `/path/to/workspace` |
| `bridgePort` | Web 服务端口 | 否 | `3000` (默认) |

### 获取飞书应用凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 进入 **开发者后台** → **创建应用** → **企业自建应用**
3. 进入应用详情页 → **凭证与基础信息**
4. 复制 **App ID** 和 **App Secret**

### 配置方式

#### 方式一: Web UI (推荐)

通过 `http://localhost:3000` 的 Web 界面进行可视化配置。

#### 方式二: 配置文件

在项目根目录创建 `.config.json`:

```json
{
  "feishuAppId": "cli_xxxxxxxxxxxxxxxx",
  "feishuAppSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "workDir": "/path/to/opencode/workspace",
  "bridgePort": 3000
}
```

**注意**: `.config.json` 包含敏感信息，已添加到 `.gitignore`，请勿提交到版本控制。

---

## 飞书应用设置

### 创建应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 点击 **创建应用** → **企业自建应用**
3. 填写应用名称和描述
4. 点击 **创建**

### 添加机器人能力

1. 进入应用详情页
2. 点击 **添加能力** → **机器人**
3. 配置机器人信息:
   - 显示名称
   - 描述
   - 头像
4. 点击 **发布**

### 获取凭证

1. 进入 **凭证与基础信息**
2. 复制 **App ID** (`cli_` 开头)
3. 点击 **App Secret** 的 **查看** 按钮，复制密钥

### 权限配置

进入 **权限管理**，添加以下权限:

| 权限 | 说明 |
|------|------|
| `im:chat:readonly` | 读取会话信息 |
| `im:message:send` | 发送消息 |
| `im:message:receive` | 接收消息 |

### 发布应用

1. 进入 **版本管理与发布**
2. 点击 **创建版本**
3. 填写版本信息
4. 点击 **申请发布**
5. 等待企业管理员审批

---

## 使用说明

### 启动桥接

1. 打开 Web 界面 `http://localhost:3000`
2. 确认配置已保存
3. 点击 **启动桥接** 按钮
4. 观察状态指示灯变为绿色 (已连接)

### 发送消息

1. 在飞书群聊或私聊中 **@机器人** 并输入消息
2. 消息将自动转发到 OpenCode
3. OpenCode 的响应将返回至飞书

**示例对话**:

```
用户: @MyBot 你好，请帮我写一段 JavaScript 代码
机器人: [OpenCode 的 AI 响应]
```

### 监控状态

Web 界面提供实时监控:
- **状态指示器**: 显示当前连接状态 (未连接/连接中/已连接/错误)
- **运行日志**: 实时显示系统日志和消息流转
- **控制按钮**: 启动/停止桥接

### 查看日志

运行日志区域显示:
- 系统启动/停止事件
- 飞书连接状态变化
- 消息接收和转发记录
- 错误和警告信息

---

## 架构

### 系统架构

```
┌─────────────────┐      WebSocket       ┌──────────────────┐      HTTP/SSE       ┌─────────────────┐
│                 │ ◄──────────────────► │                  │ ◄──────────────────► │                 │
│   Feishu App    │    (Messages)        │  Bridge Server   │    (opencode serve) │   OpenCode      │
│                 │                      │                  │                      │                 │
└─────────────────┘                      └──────────────────┘                      └─────────────────┘
                                                  │
                                                  │ Express
                                                  ▼
                                         ┌──────────────────┐
                                         │   Web UI (Port)  │
                                         └──────────────────┘
```

### 组件说明

| 组件 | 说明 |
|------|------|
| **Express Server** | Web UI 和 API 服务端点 |
| **Feishu Module** | WebSocket 连接、消息收发处理 |
| **OpenCode Module** | 进程管理、HTTP API、SSE 通信 |
| **Bridge Module** | 消息队列、双向路由转发 |
| **Config Module** | 配置管理、持久化存储 |

### 数据流向

1. **飞书 → OpenCode**:
   - 用户 @机器人发送消息
   - Feishu WebSocket 接收消息
   - Bridge 模块转发到 OpenCode
   - OpenCode 处理并生成响应

2. **OpenCode → 飞书**:
   - OpenCode 返回响应
   - Bridge 模块接收响应
   - Feishu REST API 发送消息
   - 用户收到回复

---

## API 参考

### REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/status` | 获取桥接状态 |
| `GET` | `/api/config` | 获取当前配置 |
| `POST` | `/api/config` | 保存配置 |
| `POST` | `/api/start` | 启动桥接 |
| `POST` | `/api/stop` | 停止桥接 |

### API 详情

#### GET /api/status

获取当前桥接状态。

**响应示例**:
```json
{
  "status": "connected",
  "timestamp": "2024-01-15T08:30:00.000Z"
}
```

**状态值**:
- `idle`: 未连接
- `connecting`: 连接中
- `connected`: 已连接
- `error`: 错误

#### GET /api/config

获取当前保存的配置。

**响应示例**:
```json
{
  "feishuAppId": "cli_xxxxxxxxxxxxxxxx",
  "feishuAppSecret": "",
  "workDir": "/path/to/workspace",
  "bridgePort": 3000
}
```

#### POST /api/config

保存新的配置。

**请求体**:
```json
{
  "feishuAppId": "cli_xxxxxxxxxxxxxxxx",
  "feishuAppSecret": "your-secret-key",
  "workDir": "/path/to/workspace",
  "bridgePort": 3000
}
```

**响应**:
```json
{
  "success": true,
  "config": { ... }
}
```

#### POST /api/start

启动桥接服务。

**响应**:
```json
{
  "success": true,
  "status": "connected"
}
```

#### POST /api/stop

停止桥接服务。

**响应**:
```json
{
  "success": true,
  "status": "idle"
}
```

---

## 故障排除

### 常见问题

#### "Cannot connect to Feishu"

**原因**: App ID 或 App Secret 错误

**解决方案**:
1. 检查 `feishuAppId` 是否以 `cli_` 开头
2. 确认 `feishuAppSecret` 完整且正确
3. 在 [飞书开放平台](https://open.feishu.cn/) 重新获取凭证

#### "OpenCode process failed to start"

**原因**: 工作目录不存在或 opencode 未安装

**解决方案**:
1. 确认 `workDir` 指向的路径存在
2. 运行 `which opencode` 检查 opencode 是否已安装
3. 如未安装，运行 `npm install -g @anomaly/opencode`

#### "Port already in use"

**原因**: 端口 3000 被其他程序占用

**解决方案**:
1. 修改 `.config.json` 中的 `bridgePort` 为其他端口
2. 或终止占用 3000 端口的程序

#### "Messages not forwarding"

**原因**: 机器人未被 @提及或权限不足

**解决方案**:
1. 在飞书中 @机器人名称
2. 检查应用是否已发布并添加到群组
3. 确认已授予 `im:message:receive` 权限

#### "Web UI not loading"

**原因**: 依赖未安装或构建失败

**解决方案**:
1. 运行 `npm install` 安装依赖
2. 检查 `public/index.html` 文件是否存在
3. 查看控制台是否有错误信息

### 调试技巧

1. **查看详细日志**: 修改 `src/feishu.js` 中的 `loggerLevel` 为 `'debug'`
2. **检查 WebSocket 状态**: 使用浏览器开发者工具查看 Network 面板
3. **测试 API**: 使用 curl 或 Postman 测试 API 端点

```bash
# 测试状态接口
curl http://localhost:3000/api/status

# 测试保存配置
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"feishuAppId":"test","workDir":"./work"}'
```

---

## 贡献

欢迎贡献代码、提交 Issue 或改进文档！

### 贡献步骤

1. **Fork 仓库**: 点击 GitHub 上的 Fork 按钮
2. **创建分支**: `git checkout -b feature/your-feature-name`
3. **提交更改**: `git commit -m 'Add some feature'`
4. **推送分支**: `git push origin feature/your-feature-name`
5. **提交 PR**: 在 GitHub 上提交 Pull Request

### 开发规范

- 使用 ESLint 进行代码检查: `npm run lint`
- 运行测试: `npm test`
- 保持代码风格一致
- 为新功能编写测试

---

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

```
MIT License

Copyright (c) 2024 Feishu-OpenCode Bridge

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 致谢

感谢以下开源项目和团队：

- **[Lark/Feishu SDK](https://github.com/larksuite/node-sdk)**: 飞书官方 Node.js SDK
- **[OpenCode](https://opencode.ai/)**: 由 AnomalyCo 开发的 AI 开发环境
- **[Express.js](https://expressjs.com/)**: 快速、无约束的 Node.js Web 框架

---

## 支持与联系

- **GitHub Issues**: [提交问题](https://github.com/yourusername/feishu-opencode-bridge/issues)
- **Email**: your.email@example.com

---

<p align="center">Made with ❤️ for the Feishu and OpenCode community</p>
