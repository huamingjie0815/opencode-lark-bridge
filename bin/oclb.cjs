#!/usr/bin/env node

/**
 * OpenCode-Lark Bridge CLI
 * 
 * 这是 OpenCode-Lark Bridge 的命令行工具入口文件。
 * 提供进程管理、状态查询、日志查看等功能。
 * 
 * 使用方法:
 *   oclb <command> [options]
 * 
 * 支持的命令:
 *   start   - 启动桥接服务
 *   stop    - 停止桥接服务
 *   init    - 初始化配置文件
 *   status  - 查看服务状态
 *   logs    - 查看日志
 *   help    - 显示帮助信息
 * 
 * @module oclb
 */

const path = require('path');
const { version } = require('../package.json');

// 命令映射表：将命令名映射到对应的处理模块
const COMMANDS = {
  start: './cli-commands/start.cjs',
  stop: './cli-commands/stop.cjs',
  init: './cli-commands/init.cjs',
  status: './cli-commands/status.cjs',
  logs: './cli-commands/logs.cjs',
  help: './cli-commands/help.cjs'
};

/**
 * 显示全局帮助信息
 * 当用户运行 `oclb --help` 或 `oclb help` 时显示
 */
function showGlobalHelp() {
  console.log(`
OpenCode-Lark Bridge CLI v${version}

Usage: oclb <command> [options]

Commands:
  start   Start the bridge service
  stop    Stop the bridge service
  init    Initialize configuration file
  status  Check service status
  logs    View service logs
  help    Show help information for a command

Options:
  -h, --help     Show help
  -v, --version  Show version

Examples:
  oclb start           # Start the service
  oclb start --daemon  # Start in daemon mode
  oclb status          # Check if running
  oclb logs -f         # Follow log output
  oclb help start      # Show help for start command

For more information, visit: https://github.com/your-org/opencode-lark-bridge
`);
}

/**
 * 显示版本信息
 */
function showVersion() {
  console.log(`v${version}`);
}

/**
 * 解析命令行参数
 * @returns {Object} 解析后的参数对象
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    command: null,
    options: {},
    args: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // 处理全局选项
    if (arg === '-h' || arg === '--help') {
      parsed.options.help = true;
      continue;
    }
    if (arg === '-v' || arg === '--version') {
      parsed.options.version = true;
      continue;
    }

    // 处理选项参数 (如 --daemon, -f 等)
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // 检查是否有值 (如 --port 8080)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed.options[key] = args[i + 1];
        i++; // 跳过值
      } else {
        // 布尔选项 (如 --daemon)
        parsed.options[key] = true;
      }
      continue;
    }

    // 处理短选项 (如 -f, -p 8080)
    if (arg.startsWith('-') && arg.length === 2) {
      const key = arg[1];
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed.options[key] = args[i + 1];
        i++;
      } else {
        parsed.options[key] = true;
      }
      continue;
    }

    // 第一个非选项参数是命令
    if (!parsed.command) {
      parsed.command = arg;
    } else {
      // 其余参数作为命令参数
      parsed.args.push(arg);
    }
  }

  return parsed;
}

/**
 * 执行命令的主函数
 */
async function main() {
  const parsed = parseArgs();

  // 处理全局选项
  if (parsed.options.version) {
    showVersion();
    process.exit(0);
  }

  if (parsed.options.help && !parsed.command) {
    showGlobalHelp();
    process.exit(0);
  }

  // 如果没有指定命令，显示帮助
  if (!parsed.command) {
    showGlobalHelp();
    process.exit(1);
  }

  // 检查命令是否有效
  const commandModule = COMMANDS[parsed.command];
  if (!commandModule) {
    console.error(`Error: Unknown command "${parsed.command}"`);
    console.error(`Run 'oclb help' for usage information`);
    process.exit(1);
  }

  try {
    // 动态加载并执行命令模块
    const command = require(commandModule);
    
    // 如果命令导出了 execute 函数，使用它
    if (typeof command.execute === 'function') {
      await command.execute(parsed.args, parsed.options);
    } 
    // 否则将模块本身作为函数调用
    else if (typeof command === 'function') {
      await command(parsed.args, parsed.options);
    }
    // 或者调用默认导出
    else if (typeof command.default === 'function') {
      await command.default(parsed.args, parsed.options);
    }
    else {
      throw new Error(`Command module "${parsed.command}" does not export a valid handler`);
    }
  } catch (error) {
    // 处理模块未找到的情况
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`Error: Command module for "${parsed.command}" not found`);
      console.error(`Please ensure all CLI dependencies are installed`);
    } else {
      console.error(`Error executing command "${parsed.command}":`, error.message);
    }
    
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// 启动 CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
