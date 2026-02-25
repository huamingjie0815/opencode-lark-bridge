# NPM 发布与 CLI 实现计划

## 目标
将飞书-OpenCode 桥接工具打包为 NPM 包 `feishu-opencode-bridge`，提供便捷的 CLI 命令，支持从 OpenCode 工作目录自动读取配置。

## 实现步骤

### Task 1: 创建 CLI 基础结构

**文件**: `bin/feishu-bridge.js`

**功能**:
- CLI 入口点，解析命令行参数
- 支持命令：start, stop, init, status, logs, help
- 全局选项：--version, --help

**代码结构**:
```javascript
#!/usr/bin/env node
const path = require('path');

// 解析命令行参数
function parseArgs(args) { ... }

// 主函数
async function main() {
  const command = process.argv[2] || 'help';
  switch (command) {
    case 'start': await startCommand(options); break;
    case 'stop': await stopCommand(options); break;
    case 'init': await initCommand(options); break;
    case 'status': await statusCommand(options); break;
    case 'logs': await logsCommand(options); break;
    default: showHelp();
  }
}
```

### Task 2: 实现 start 命令

**文件**: `bin/cli-commands/start.js`

**功能**:
- 启动桥接服务
- 智能配置读取（优先级从高到低）：
  1. `--config` 指定的配置文件
  2. `--workdir` 指定的工作目录 + `.config.json`
  3. 当前目录（如果是 OpenCode 工作目录，包含 `.config.json`）
  4. 环境变量 `FEISHU_BRIDGE_CONFIG`
  5. 默认配置

**代码逻辑**:
```javascript
async function startCommand(options) {
  // 1. 确定工作目录
  const workDir = options.workdir || process.cwd();
  
  // 2. 查找配置文件
  let config = null;
  
  // 优先级 1: --config 参数
  if (options.config) {
    config = loadConfigFromFile(options.config);
  }
  
  // 优先级 2: --workdir + .config.json
  if (!config && options.workdir) {
    config = loadConfigFromWorkDir(options.workdir);
  }
  
  // 优先级 3: 当前目录
  if (!config) {
    config = loadConfigFromWorkDir(process.cwd());
  }
  
  // 优先级 4: 环境变量
  if (!config && process.env.FEISHU_BRIDGE_CONFIG) {
    config = loadConfigFromFile(process.env.FEISHU_BRIDGE_CONFIG);
  }
  
  // 优先级 5: 默认配置
  if (!config) {
    config = getDefaultConfig();
  }
  
  // 3. 启动服务
  await startBridge(config);
}
```

### Task 3: 实现其他 CLI 命令

**文件**: 
- `bin/cli-commands/stop.js` - 停止服务
- `bin/cli-commands/init.js` - 初始化配置
- `bin/cli-commands/status.js` - 查看状态
- `bin/cli-commands/logs.js` - 查看日志

**stop 命令**:
- 读取 PID 文件
- 发送停止信号
- 清理 PID 文件

**init 命令**:
- 交互式配置向导
- 创建默认配置文件
- 保存到指定工作目录

**status 命令**:
- 检查服务运行状态
- 显示 PID、端口、运行时间

**logs 命令**:
- 读取日志文件
- 支持 `--follow` 实时跟踪

### Task 4: 更新 package.json

**修改内容**:
```json
{
  "name": "feishu-opencode-bridge",
  "version": "1.0.0",
  "description": "Bridge tool connecting Feishu (Lark) with OpenCode AI development environment",
  "main": "src/index.js",
  "bin": {
    "feishu-bridge": "./bin/feishu-bridge.js"
  },
  "scripts": {
    "start": "node src/index.js",
    "test": "node test-e2e.js"
  },
  "keywords": [
    "feishu",
    "lark",
    "opencode",
    "bridge",
    "bot",
    "webhook",
    "cli"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.0",
    "@larksuiteoapi/node-sdk": "^1.24.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "preferGlobal": true,
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/feishu-opencode-bridge.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/feishu-opencode-bridge/issues"
  },
  "homepage": "https://github.com/yourusername/feishu-opencode-bridge#readme"
}
```

### Task 5: 实现进程管理

**文件**: `lib/process-manager.js`

**功能**:
- PID 文件管理
- 进程启动/停止
- 状态检查
- 优雅关闭

```javascript
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PID_FILE = path.join(process.cwd(), '.feishu-bridge.pid');

class ProcessManager {
  // 保存 PID
  static savePid(pid) {
    fs.writeFileSync(PID_FILE, pid.toString(), 'utf-8');
  }

  // 读取 PID
  static getPid() {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    return parseInt(pid) || null;
  }

  // 检查进程是否运行
  static isRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 获取状态
  static getStatus() {
    const pid = this.getPid();
    if (!pid) return { running: false, pid: null };
    
    const running = this.isRunning(pid);
    if (!running) {
      this.removePid(); // 清理无效 PID 文件
      return { running: false, pid: null };
    }
    
    return { running: true, pid };
  }

  // 停止进程
  static async stop() {
    const pid = this.getPid();
    if (!pid) {
      throw new Error('Bridge is not running (no PID file found)');
    }

    if (!this.isRunning(pid)) {
      this.removePid();
      throw new Error('Bridge is not running (process not found)');
    }

    // 发送 SIGTERM 信号
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      throw new Error(`Failed to stop bridge: ${error.message}`);
    }

    // 等待进程结束
    let attempts = 0;
    const maxAttempts = 30; // 最多等待 3 秒
    
    while (this.isRunning(pid) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // 如果进程还在运行，强制杀死
    if (this.isRunning(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {
        // ignore
      }
    }

    this.removePid();
    return { stopped: true, pid };
  }

  // 删除 PID 文件
  static removePid() {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  }
}

module.exports = ProcessManager;
```

### Task 6: 创建 CLI 命令文件

**文件**: 
- `bin/cli-commands/start.js`
- `bin/cli-commands/stop.js`
- `bin/cli-commands/init.js`
- `bin/cli-commands/status.js`
- `bin/cli-commands/logs.js`

每个命令文件实现对应的功能。

### Task 7: 更新文档

**文件**: `README.md`, `README_EN.md`

**更新内容**:
- 添加 CLI 命令使用说明
- 更新安装说明（全局安装）
- 添加命令示例

### Task 8: 测试和发布

**步骤**:
1. 本地测试 CLI 命令
2. 打包验证
3. 发布到 NPM
4. 验证安装

## 关键设计决策

1. **配置优先级**：命令行参数 > 环境变量 > 配置文件 > 默认配置
2. **工作目录检测**：自动检测当前目录是否为 OpenCode 工作目录（包含 .config.json）
3. **进程管理**：使用 PID 文件管理后台进程，支持优雅停止
4. **日志管理**：统一日志输出，支持实时跟踪

## 使用示例

```bash
# 全局安装
npm install -g feishu-opencode-bridge

# 在工作目录启动（自动读取当前目录的 .config.json）
cd /path/to/opencode/workspace
feishu-bridge start

# 指定工作目录启动
feishu-bridge start --workdir /path/to/workspace

# 指定配置文件启动
feishu-bridge start --config /path/to/config.json

# 查看状态
feishu-bridge status

# 停止服务
feishu-bridge stop

# 查看日志
feishu-bridge logs --follow

# 初始化配置
feishu-bridge init --workdir /path/to/workspace
```

## 注意事项

1. **权限**：确保有权限写入工作目录（创建 .config.json）
2. **Node.js 版本**：要求 >= 18.0.0
3. **依赖**：需要安装 opencode CLI（`npm install -g @anomaly/opencode`）
4. **防火墙**：确保端口未被防火墙阻止
