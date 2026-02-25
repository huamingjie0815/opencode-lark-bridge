/**
 * Help Command - 显示帮助信息
 * 
 * 使用方法:
 *   oclb help [command]
 * 
 * 示例:
 *   oclb help
 *   oclb help start
 *   oclb help init
 */

const COMMANDS = {
  start: './start',
  stop: './stop',
  init: './init',
  status: './status',
  logs: './logs',
  help: './help'
};

/**
 * 显示全局帮助信息
 */
function showGlobalHelp() {
  console.log(`
OpenCode-Lark Bridge CLI

USAGE:
    oclb <command> [options]

COMMANDS:
    start     Start the bridge service
    stop      Stop the bridge service
    init      Initialize configuration
    status    Check service status
    logs      View service logs
    help      Show help for a command

GLOBAL OPTIONS:
    -h, --help       Show help
    -v, --version    Show version

EXAMPLES:
    oclb init                    # Initialize config
    oclb start                   # Start service
    oclb start --daemon          # Start in background
    oclb status                  # Check status
    oclb logs -f                 # Follow logs
    oclb stop                    # Stop service

For more help on a specific command:
    oclb help <command>

For full documentation, visit:
    https://github.com/your-org/feishu-opencode-bridge
`);
}

/**
 * 显示特定命令的帮助
 * @param {string} commandName - 命令名称
 */
async function showCommandHelp(commandName) {
  // 检查命令是否存在
  if (!COMMANDS[commandName]) {
    console.error(`Error: Unknown command "${commandName}"`);
    console.error(`\nAvailable commands: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  try {
    // 加载命令模块并显示其帮助
    const command = require(COMMANDS[commandName]);
    
    if (typeof command.showHelp === 'function') {
      command.showHelp();
    } else {
      console.log(`\nHelp for command: ${commandName}`);
      console.log('No detailed help available for this command.\n');
    }
  } catch (error) {
    console.error(`Error loading help for command "${commandName}":`, error.message);
    process.exit(1);
  }
}

/**
 * 执行 help 命令
 * @param {string[]} args - 位置参数 (第一个元素是要获取帮助的命令名)
 * @param {Object} options - 命令选项
 */
async function execute(args, options = {}) {
  // 如果指定了特定命令，显示该命令的帮助
  if (args && args.length > 0) {
    await showCommandHelp(args[0]);
    return;
  }

  // 显示全局帮助
  showGlobalHelp();
}

module.exports = {
  execute,
  showHelp: showGlobalHelp,
  showCommandHelp
};
