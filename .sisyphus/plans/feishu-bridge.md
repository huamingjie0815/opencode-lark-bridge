# 飞书机器人桥接工具

## TL;DR

> **Quick Summary**: 构建一个 Node.js 桥接工具，实现 OpenCode 与飞书机器人的双向通信。通过 `opencode serve` HTTP API + 飞书 WebSocket 长连接，用户可在飞书 App 中与 OpenCode 对话。
> 
> **Deliverables**:
> - Express 后端 + 简单 Web UI
> - 飞书长连接集成（@larksuiteoapi/node-sdk）
> - OpenCode Server API 客户端（HTTP + SSE）
> - 配置持久化（JSON 配置文件）
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: 项目结构 → 配置管理 → OpenCode Server API 客户端 → 飞书集成 → Web UI → 集成测试

---

## Context

### Original Request
阅读飞书机器人文档，实现桥接工具将 OpenCode 和飞书实现双向通信。即在本地启动的 OpenCode 消息可以通过飞书机器人推送到飞书对话，用户也可以 @机器人发送消息给 OpenCode。提供简单界面在指定目录下启动 OpenCode 和飞书长连接。

### Interview Summary
**Key Discussions**:
- 技术栈：纯 Node.js (Express) + 简单 Web UI
- 配置：界面输入 + 配置文件持久化
- 界面：Web 界面（浏览器访问）
- 消息：纯文本
- 会话：单会话模式
- OpenCode 交互：通过 `opencode serve` HTTP API（发现确实有 serve 模式！）

**Research Findings**:
- 飞书支持 WebSocket 长连接，无需公网 IP
- OpenCode **有** `opencode serve` 模式！提供完整的 HTTP API 和 SSE 事件流
- API 文档：https://opencode.ai/docs/server/
- 关键端点：`POST /session/:id/message` 发送消息，`GET /event` SSE 流接收事件

### Metis Review
**Identified Gaps** (addressed):
- `opencode serve` 协议：**存在！** 使用 HTTP API + SSE
- 飞书权限：明确列出所需权限
- 配置格式：明确使用 JSON
- 消息可靠性：FIFO 队列，断开时缓存

---

## Work Objectives

### Core Objective
构建一个可靠的桥接工具，让用户可以在飞书 App 中与本地运行的 OpenCode 进行双向对话。

### Concrete Deliverables
- `package.json` - 项目依赖配置
- `src/index.js` - Express 服务入口
- `src/config.js` - 配置管理模块
- `src/opencode.js` - OpenCode Server API 客户端
- `src/feishu.js` - 飞书长连接集成
- `public/index.html` - Web 控制界面
- `.config.json` (运行时生成) - 持久化配置

### Definition of Done
- [ ] `npm install && npm start` 成功启动服务
- [ ] 浏览器访问 `http://localhost:3000` 显示配置界面
- [ ] 配置飞书 App ID/Secret 和工作目录后可启动连接
- [ ] 在飞书中 @ 机器人发送消息，OpenCode 能收到并回复
- [ ] OpenCode 的输出能转发到飞书对话

### Must Have
- 飞书 WebSocket 长连接（@larksuiteoapi/node-sdk ≥1.24.0）
- OpenCode Server API 客户端（HTTP + SSE）
- Web 配置界面（浏览器访问）
- 配置持久化（JSON 文件）
- 单会话模式（一对一）
- 消息队列（FIFO，断开时缓存）

### Must NOT Have (Guardrails)
- NO 多会话支持（明确排除）
- NO 富文本/卡片（仅纯文本）
- NO 消息历史数据库（仅内存队列）
- NO 用户认证（本地使用场景）
- NO 除 Express 和飞书 SDK 外的外部依赖
- NO 修改 OpenCode 源码或参数
- NO 直接暴露 OpenCode Server 到网络（桥接工具作为代理）
- NO 明文存储密钥（可选加密，至少 .gitignore）

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO - 新项目
- **Automated tests**: Tests-after
- **Framework**: Node.js built-in assert + Playwright for UI
- **If TDD**: N/A

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Use interactive_bash (tmux) — Run command, validate output
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Use Bash (node REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 基础 + 配置):
├── Task 1: 项目结构初始化 + package.json [quick]
├── Task 2: 配置管理模块 (config.js) [quick]
├── Task 3: Express 服务基础 + 静态文件 [quick]
└── Task 4: Web UI 基础页面 (index.html) [quick]

Wave 2 (After Wave 1 — 核心模块，并行):
├── Task 5: OpenCode 子进程管理模块 (opencode.js) [unspecified-high]
├── Task 6: 飞书长连接集成模块 (feishu.js) [unspecified-high]
├── Task 7: 消息队列 + 桥接逻辑 [unspecified-high]
└── Task 8: Web UI 完整功能 (配置表单 + 状态) [visual-engineering]

Wave 3 (After Wave 2 — 集成 + QA):
├── Task 9: 完整集成测试 (端到端流程) [deep]
├── Task 10: README 文档 [writing]
└── Task 11: 最终 QA 和清理 [unspecified-high]
```

### Dependency Matrix

- **1-4**: None - can start immediately
- **5**: 1, 2, 3
- **6**: 1, 2, 3
- **7**: 5, 6
- **8**: 1, 3, 4
- **9**: 5, 6, 7, 8
- **10**: 9
- **11**: 10

### Agent Dispatch Summary

- **Wave 1**: 4 tasks - all `quick`
- **Wave 2**: 4 tasks - 3×`unspecified-high`, 1×`visual-engineering`
- **Wave 3**: 3 tasks - 1×`deep`, 1×`writing`, 1×`unspecified-high`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. 项目结构初始化 + package.json

  **What to do**:
  - 创建项目目录结构
  - 初始化 `package.json`，配置依赖：
    - `express` (^4.18.0)
    - `@larksuiteoapi/node-sdk` (^1.24.0)
  - 配置 npm scripts：
    - `start`: `node src/index.js`
    - `dev`: `node --watch src/index.js`
  - 创建 `.gitignore`，包含：
    - `node_modules/`
    - `.config.json`
    - `.env`

  **Must NOT do**:
  - 添加不必要的依赖（如 TypeScript、构建工具等）
  - 创建过多目录层级

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 基础项目搭建，快速完成
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 不需要，仅基础结构

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11
  - **Blocked By**: None (can start immediately)

  **References**:
  - N/A - 新项目

  **Acceptance Criteria**:
  - [ ] `npm install` 成功执行
  - [ ] `package.json` 包含所需依赖和 scripts
  - [ ] `.gitignore` 存在且包含正确条目

  **QA Scenarios**:

  ```
  Scenario: npm install succeeds
    Tool: Bash (npm)
    Preconditions: package.json exists
    Steps:
      1. Run `npm install`
      2. Check node_modules directory exists
      3. Run `npm ls express @larksuiteoapi/node-sdk`
    Expected Result: All dependencies installed, no errors
    Evidence: .sisyphus/evidence/task-1-npm-install.txt

  Scenario: npm scripts work
    Tool: Bash (npm)
    Preconditions: npm install completed
    Steps:
      1. Run `npm run start -- --help` (or just verify script exists)
      2. Check package.json for "start" and "dev" scripts
    Expected Result: Scripts are properly configured
    Evidence: .sisyphus/evidence/task-1-scripts.json
  ```

  **Evidence to Capture**:
  - [ ] npm install 输出
  - [ ] package.json 内容

  **Commit**: YES
  - Message: `feat: initialize project structure`
  - Files: `package.json`, `.gitignore`
  - Pre-commit: `npm install`

---

- [ ] 2. 配置管理模块 (config.js)

  **What to do**:
  - 创建 `src/config.js`
  - 功能：
    - 加载/保存 JSON 配置文件（默认 `.config.json`）
    - 配置字段：
      - `feishuAppId`: 飞书应用 ID
      - `feishuAppSecret`: 飞书应用密钥
      - `workDir`: OpenCode 工作目录
      - `bridgePort`: 桥接服务端口（默认 3000）
    - 验证配置完整性
    - 默认值处理
  - 导出 API：
    - `loadConfig(path?)`
    - `saveConfig(config, path?)`
    - `validateConfig(config)`

  **Must NOT do**:
  - 加密配置（第一版简单处理，仅 .gitignore 保护）
  - 支持多种配置格式（仅 JSON）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的文件读写模块
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7
  - **Blocked By**: None

  **References**:
  - N/A

  **Acceptance Criteria**:
  - [ ] 模块可通过 `node -r src/config.js` 加载
  - [ ] `saveConfig()` 写入 JSON 文件
  - [ ] `loadConfig()` 读取并解析 JSON
  - [ ] `validateConfig()` 正确验证必填字段

  **QA Scenarios**:

  ```
  Scenario: Save and load config
    Tool: Bash (node)
    Preconditions: src/config.js exists
    Steps:
      1. Create test script:
         echo "const { saveConfig, loadConfig } = require('./src/config');
         const testConfig = { feishuAppId: 'test_id', feishuAppSecret: 'test_secret', workDir: '/tmp/test' };
         saveConfig(testConfig, '.test-config.json');
         const loaded = loadConfig('.test-config.json');
         console.log('Match:', JSON.stringify(testConfig) === JSON.stringify(loaded));" > test-config.js
      2. Run `node test-config.js`
      3. Verify output is "Match: true"
      4. Clean up: rm .test-config.json test-config.js
    Expected Result: Config round-trip works
    Evidence: .sisyphus/evidence/task-2-config-roundtrip.txt

  Scenario: Validate config
    Tool: Bash (node)
    Preconditions: src/config.js exists
    Steps:
      1. Test with valid config
      2. Test with missing feishuAppId
      3. Test with missing feishuAppSecret
      4. Test with missing workDir
    Expected Result: validateConfig correctly identifies valid/invalid
    Evidence: .sisyphus/evidence/task-2-validation.txt
  ```

  **Evidence to Capture**:
  - [ ] 配置读写测试输出
  - [ ] 验证测试输出

  **Commit**: YES
  - Message: `feat: add config management module`
  - Files: `src/config.js`
  - Pre-commit: `node -e "require('./src/config')"`

---

- [ ] 3. Express 服务基础 + 静态文件

  **What to do**:
  - 创建 `src/index.js`
  - 初始化 Express 应用
  - 配置静态文件服务（`public/` 目录）
  - 配置 JSON body parser
  - 基础 API 端点：
    - `GET /api/status` - 返回桥接状态
    - `GET /api/config` - 返回当前配置
    - `POST /api/config` - 保存配置
    - `POST /api/start` - 启动桥接
    - `POST /api/stop` - 停止桥接
  - 监听端口（默认 3000）

  **Must NOT do**:
  - 添加认证中间件（本地使用）
  - 添加 CORS（本地访问）
  - 添加日志库（用 console 即可）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 基础 Express 服务搭建
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6, 7, 8
  - **Blocked By**: None

  **References**:
  - Express 官方文档: https://expressjs.com/

  **Acceptance Criteria**:
  - [ ] `npm start` 启动服务并监听 3000 端口
  - [ ] `curl http://localhost:3000/api/status` 返回 JSON
  - [ ] 静态文件可访问

  **QA Scenarios**:

  ```
  Scenario: Server starts successfully
    Tool: Bash (curl + tmux)
    Preconditions: npm install completed
    Steps:
      1. Start server in background: node src/index.js &
      2. Sleep 2 seconds
      3. Run: curl -s http://localhost:3000/api/status
      4. Verify JSON response
      5. Kill server: pkill -f "node src/index.js"
    Expected Result: Server responds to API calls
    Evidence: .sisyphus/evidence/task-3-server-start.txt

  Scenario: Static files served
    Tool: Bash (curl)
    Preconditions: public/index.html exists
    Steps:
      1. Start server (tmux session)
      2. curl -s http://localhost:3000/ | head -20
      3. Verify HTML content
    Expected Result: index.html is served
    Evidence: .sisyphus/evidence/task-3-static-files.html
  ```

  **Evidence to Capture**:
  - [ ] 服务启动输出
  - [ ] API 响应

  **Commit**: YES
  - Message: `feat: add Express server foundation`
  - Files: `src/index.js`
  - Pre-commit: `node src/index.js --help || true`

---

- [ ] 4. Web UI 基础页面 (index.html)

  **What to do**:
  - 创建 `public/index.html`
  - 基础 HTML 结构
  - 简单布局：
    - 标题：飞书 ↔ OpenCode 桥接
    - 配置表单区域
    - 状态显示区域
    - 启动/停止按钮
  - 内联 CSS（简单样式即可）
  - 基础 JavaScript 框架（使用 fetch API）

  **Must NOT do**:
  - 使用 React/Vue 等框架
  - 引入外部 CSS 库（如 Bootstrap）
  - 过度美化（功能优先）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单 HTML 页面
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1, 2, 3)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:
  - N/A

  **Acceptance Criteria**:
  - [ ] 页面可通过浏览器访问
  - [ ] 包含所有必要的 UI 元素
  - [ ] 无 JavaScript 错误

  **QA Scenarios**:

  ```
  Scenario: Page loads without errors
    Tool: Playwright
    Preconditions: Server running on port 3000
    Steps:
      1. Navigate to http://localhost:3000
      2. Wait for page load
      3. Check for JavaScript errors in console
      4. Verify title, form fields, and buttons exist
    Expected Result: Page loads cleanly, all elements present
    Evidence: .sisyphus/evidence/task-4-ui-load.png

  Scenario: Form fields exist
    Tool: Playwright
    Preconditions: Page loaded
    Steps:
      1. Check for input: feishuAppId
      2. Check for input: feishuAppSecret
      3. Check for input: workDir
      4. Check for buttons: Save Config, Start, Stop
    Expected Result: All form elements exist
    Evidence: .sisyphus/evidence/task-4-form-fields.png
  ```

  **Evidence to Capture**:
  - [ ] 页面加载截图
  - [ ] 表单字段截图

  **Commit**: YES
  - Message: `feat: add basic Web UI`
  - Files: `public/index.html`
  - Pre-commit: N/A

---

- [ ] 5. OpenCode Server 进程管理 + API 客户端 (opencode.js)

  **What to do**:
  - 创建 `src/opencode.js`
  - 功能：
    - **进程管理**：
      - 通过 `child_process.spawn` 启动 `opencode serve` 进程
      - 支持配置：workDir（工作目录）、port（端口）、host（主机）
      - 命令：`opencode serve --port <port> --hostname <host>` 在指定 workDir 运行
      - 监控进程健康（/global/health 轮询）
      - 支持优雅停止
    - **API 客户端**：
      - HTTP 客户端连接 OpenCode Server
      - `createSession()` - 创建新会话
      - `sendMessage(sessionId, text)` - 发送消息到会话
      - `getEventStream()` - 连接 SSE 事件流
    - 事件：`message`、`connected`、`disconnected`、`error`
  - 导出 API：
    - `start(config)` - 启动 opencode serve 并连接 API
    - `stop()` - 停止 opencode serve 并断开连接
    - `createSession()`
    - `sendMessage(sessionId, text)`
    - `on(event, handler)`

  **Must NOT do**:
  - 修改 `opencode serve` 的参数除 --port、--hostname、工作目录外
  - 假设 `opencode` 在 PATH 中（提示用户安装）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 进程管理 + API 集成需要仔细处理
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 6)
  - **Parallel Group**: Wave 2 (Tasks 6, 7, 8)
  - **Blocks**: Task 7, 9
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - OpenCode Server 文档: https://opencode.ai/docs/server/
  - Node.js child_process: https://nodejs.org/api/child_process.html

  **Acceptance Criteria**:
  - [ ] 模块可导入并初始化
  - [ ] `start()` 成功 spawn `opencode serve` 进程
  - [ ] 进程启动后可通过 HTTP 连接
  - [ ] `stop()` 成功终止进程

  **QA Scenarios**:

  ```
  Scenario: Spawn opencode serve and verify health
    Tool: Bash (node + curl + pgrep)
    Preconditions: src/opencode.js exists, opencode CLI installed
    Steps:
      1. Create test script
      2. Call start({ workDir: '/tmp/test', port: 4099, host: '127.0.0.1' })
      3. Sleep 3 seconds
      4. Verify with pgrep that process exists
      5. Run curl http://127.0.0.1:4099/global/health
      6. Verify healthy response
      7. Call stop()
      8. Verify process no longer exists
    Expected Result: Full lifecycle works
    Evidence: .sisyphus/evidence/task-5-lifecycle.txt

  Scenario: API client methods exist
    Tool: Bash (node)
    Preconditions: src/opencode.js exists
    Steps:
      1. Check that start(), stop(), createSession(), sendMessage() are exported
    Expected Result: All API methods present
    Evidence: .sisyphus/evidence/task-5-api-methods.txt
  ```

  **Evidence to Capture**:
  - [ ] 进程生命周期测试输出
  - [ ] API 方法验证

  **Commit**: YES
  - Message: `feat: add OpenCode Server process manager + API client`
  - Files: `src/opencode.js`
  - Pre-commit: `node -e "require('./src/opencode')"`

---

- [ ] 6. 飞书长连接集成模块 (feishu.js)

  **What to do**:
  - 创建 `src/feishu.js`
  - 功能：
    - 使用 `@larksuiteoapi/node-sdk`
    - 初始化 WSClient
    - 注册 `im.message.receive_v1` 事件
    - 处理 @机器人消息
    - 发送消息到飞书对话
    - 事件：`message`、`connected`、`disconnected`、`error`
  - 导出 API：
    - `start(appId, appSecret)` - 启动长连接
    - `stop()` - 停止连接
    - `sendMessage(chatId, text)` - 发送消息
    - `on(event, handler)` - 监听事件

  **Must NOT do**:
  - 实现除消息接收/发送外的其他飞书功能
  - 处理富文本（仅纯文本）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 飞书 SDK 集成需要仔细处理
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2 (Tasks 5, 7, 8)
  - **Blocks**: Task 7, 9
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - 飞书长连接文档: https://feishu.apifox.cn/doc-7518429
  - @larksuiteoapi/node-sdk 文档

  **Acceptance Criteria**:
  - [ ] 模块可导入
  - [ ] SDK 依赖正确安装
  - [ ] API 导出完整

  **QA Scenarios**:

  ```
  Scenario: Module loads without errors
    Tool: Bash (node)
    Preconditions: npm install completed
    Steps:
      1. Run: node -e "require('./src/feishu')"
      2. Verify no errors
    Expected Result: Module loads cleanly
    Evidence: .sisyphus/evidence/task-6-module-load.txt

  Scenario: SDK import works
    Tool: Bash (node)
    Preconditions: src/feishu.js exists
    Steps:
      1. Check that @larksuiteoapi/node-sdk is imported
      2. Verify WSClient and EventDispatcher are accessible
    Expected Result: SDK classes are available
    Evidence: .sisyphus/evidence/task-6-sdk-import.txt
  ```

  **Evidence to Capture**:
  - [ ] 模块加载测试输出

  **Commit**: YES
  - Message: `feat: add Feishu WebSocket integration`
  - Files: `src/feishu.js`
  - Pre-commit: `node -e "require('./src/feishu')"`

---

- [ ] 7. 消息队列 + 桥接逻辑

  **What to do**:
  - 创建 `src/bridge.js`
  - 功能：
    - FIFO 消息队列（内存队列）
    - 桥接 OpenCode 和 Feishu 模块
    - 处理状态管理（idle/connecting/connected/error）
    - 消息去重/节流（可选）
    - 集成到 Express API 端点
  - 导出 API：
    - `start(config)` - 启动桥接
    - `stop()` - 停止桥接
    - `getStatus()` - 获取当前状态
  - 更新 `src/index.js` 集成 bridge

  **Must NOT do**:
  - 持久化队列到数据库
  - 实现复杂的消息路由

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 核心桥接逻辑，需要仔细集成
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 5, 6

  **References**:
  - N/A

  **Acceptance Criteria**:
  - [ ] 桥接模块可导入
  - [ ] `start()`/`stop()` 工作正常
  - 状态正确更新

  **QA Scenarios**:

  ```
  Scenario: Bridge lifecycle
    Tool: Bash (node)
    Preconditions: src/bridge.js exists
    Steps:
      1. Import bridge
      2. Call getStatus() - should be 'idle'
      3. Simulate start (mock config)
      4. Verify status transitions
    Expected Result: Status management works
    Evidence: .sisyphus/evidence/task-7-bridge-lifecycle.txt

  Scenario: Message queue FIFO
    Tool: Bash (node)
    Preconditions: src/bridge.js exists
    Steps:
      1. Enqueue messages: 'msg1', 'msg2', 'msg3'
      2. Dequeue and verify order
    Expected Result: Messages dequeued in FIFO order
    Evidence: .sisyphus/evidence/task-7-queue-fifo.txt
  ```

  **Evidence to Capture**:
  - [ ] 生命周期测试输出
  - [ ] 队列测试输出

  **Commit**: YES
  - Message: `feat: add message queue and bridge logic`
  - Files: `src/bridge.js`, `src/index.js` (updated)
  - Pre-commit: `node -e "require('./src/bridge')"`

---

- [ ] 8. Web UI 完整功能 (配置表单 + 状态)

  **What to do**:
  - 更新 `public/index.html`
  - 功能：
    - 配置表单：App ID、App Secret、工作目录、端口
    - 保存配置按钮（调用 POST /api/config）
    - 加载现有配置（调用 GET /api/config）
    - 启动/停止按钮（调用 POST /api/start /stop）
    - 实时状态显示（轮询 GET /api/status）
    - 连接状态指示（颜色：灰色=idle，黄色=connecting，绿色=connected，红色=error）
    - 简单的日志显示

  **Must NOT do**:
  - 使用复杂的前端框架
  - 添加消息历史显示
  - 过度美化

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX 优化
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 5, 6, 7)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 3, 4

  **References**:
  - Task 4 (public/index.html)

  **Acceptance Criteria**:
  - [ ] 配置表单可保存和加载
  - [ ] 状态实时显示
  - [ ] 启动/停止按钮工作

  **QA Scenarios**:

  ```
  Scenario: Save and load config via UI
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3000
      2. Fill form: test_app_id, test_app_secret, /tmp/work
      3. Click "Save Config"
      4. Refresh page
      5. Verify form fields are populated
    Expected Result: Config round-trip via UI works
    Evidence: .sisyphus/evidence/task-8-ui-config.png

  Scenario: Status display updates
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to page
      2. Observe initial status (idle)
      3. (Mock start) - verify status changes
    Expected Result: Status indicator updates correctly
    Evidence: .sisyphus/evidence/task-8-ui-status.png
  ```

  **Evidence to Capture**:
  - [ ] 配置保存/加载截图
  - [ ] 状态显示截图

  **Commit**: YES
  - Message: `feat: complete Web UI functionality`
  - Files: `public/index.html` (updated)
  - Pre-commit: N/A

---

- [ ] 9. 完整集成测试 (端到端流程)

  **What to do**:
  - 创建测试脚本 `test-e2e.js`
  - 测试完整流程：
    1. 启动桥接服务
    2. 保存测试配置
    3. 模拟飞书消息（通过内部 API）
    4. 验证 OpenCode 收到消息
    5. 模拟 OpenCode 回复
    6. 验证飞书发送回调被调用
    7. 停止桥接
  - 使用 mock 避免真实网络请求
  - 更新 `package.json` 添加 `test` script

  **Must NOT do**:
  - 依赖真实的飞书或 OpenCode 服务
  - 发送真实的网络请求

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 端到端集成测试需要深度验证
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 5, 6, 7, 8

  **References**:
  - All previous tasks

  **Acceptance Criteria**:
  - [ ] `npm test` 成功运行
  - [ ] 所有测试通过

  **QA Scenarios**:

  ```
  Scenario: Full E2E test passes
    Tool: Bash (npm test)
    Preconditions: All modules complete
    Steps:
      1. Run: npm test
      2. Verify all tests pass
    Expected Result: All tests pass, no errors
    Evidence: .sisyphus/evidence/task-9-e2e-test.txt
  ```

  **Evidence to Capture**:
  - [ ] E2E 测试输出

  **Commit**: YES
  - Message: `feat: add end-to-end integration tests`
  - Files: `test-e2e.js`, `package.json` (updated)
  - Pre-commit: `npm test`

---

- [ ] 10. README 文档

  **What to do**:
  - 创建 `README.md`
  - 内容：
    - 项目简介
    - 功能特性
    - 快速开始：
      - 前置条件（Node.js, opencode CLI, 飞书机器人）
      - 安装步骤
      - 配置步骤（飞书应用创建）
      - 运行方式
    - 使用说明
    - 架构说明
    - 故障排除

  **Must NOT do**:
  - 写过长的文档
  - 包含与项目无关的内容

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 文档编写
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 11
  - **Blocked By**: Task 9

  **References**:
  - 飞书文档: https://feishu.apifox.cn/doc-7518429
  - OpenCode: https://github.com/anomalyco/opencode

  **Acceptance Criteria**:
  - [ ] README.md 存在
  - [ ] 包含所有必要章节

  **QA Scenarios**:

  ```
  Scenario: README exists and is complete
    Tool: Bash (cat + grep)
    Preconditions: README.md created
    Steps:
      1. Check README.md exists
      2. Grep for key sections: Quick Start, Installation, Usage
    Expected Result: All sections present
    Evidence: .sisyphus/evidence/task-10-readme.txt
  ```

  **Evidence to Capture**:
  - [ ] README 内容验证

  **Commit**: YES
  - Message: `docs: add README documentation`
  - Files: `README.md`
  - Pre-commit: N/A

---

- [ ] 11. 最终 QA 和清理

  **What to do**:
  - 运行所有测试
  - 验证 `npm install && npm start` 工作
  - 检查代码风格
  - 清理临时文件
  - 验证所有证据文件存在
  - 最终验证文档

  **Must NOT do**:
  - 添加新功能
  - 重构代码

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 最终 QA 和验证
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: Task 10

  **References**:
  - All previous tasks

  **Acceptance Criteria**:
  - [ ] 所有测试通过
  - [ ] 项目可正常启动
  - [ ] 无遗留临时文件

  **QA Scenarios**:

  ```
  Scenario: Full project verification
    Tool: Bash
    Preconditions: All tasks complete
    Steps:
      1. Clean: rm -rf node_modules && rm -f .config.json
      2. npm install
      3. npm test
      4. npm start (in background, verify it runs)
      5. Verify no errors
    Expected Result: Full workflow works
    Evidence: .sisyphus/evidence/task-11-final-qa.txt
  ```

  **Evidence to Capture**:
  - [ ] 最终 QA 输出

  **Commit**: YES
  - Message: `chore: final QA and cleanup`
  - Files: Various (cleanup only)
  - Pre-commit: `npm test && npm run start -- --help`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `node --check src/*.js`. Review all changed files for: empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Verify npm install, npm start, npm test all work. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `feat: initialize project structure` — package.json, .gitignore
- **2**: `feat: add config management module` — src/config.js
- **3**: `feat: add Express server foundation` — src/index.js
- **4**: `feat: add basic Web UI` — public/index.html
- **5**: `feat: add OpenCode subprocess management` — src/opencode.js
- **6**: `feat: add Feishu WebSocket integration` — src/feishu.js
- **7**: `feat: add message queue and bridge logic` — src/bridge.js, src/index.js
- **8**: `feat: complete Web UI functionality` — public/index.html
- **9**: `feat: add end-to-end integration tests` — test-e2e.js, package.json
- **10**: `docs: add README documentation` — README.md
- **11**: `chore: final QA and cleanup` — cleanup

---

## Success Criteria

### Verification Commands
```bash
npm install     # Expected: All dependencies installed
npm test        # Expected: All tests pass
npm start       # Expected: Server listens on port 3000
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Project starts successfully
