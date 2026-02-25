/**
 * Start Command - 启动桥接服务
 * 
 * 使用方法:
 *   oclb start [options]
 * 
 * 选项:
 *   --daemon, -d    在后台运行 (守护进程模式)
 *   --port, -p      指定端口 (覆盖配置文件)
 *   --work-dir, -w  指定工作目录
 * 
 * 示例:
 *   oclb start
 *   oclb start --daemon
 *   oclb start -p 8080 -d
 */

const path = require('path');
const ProcessManager = require('../../lib/process-manager.cjs');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Usage: oclb start [options]

Start the Feishu-OpenCode bridge service

Options:
  -d, --daemon        Run in background (daemon mode)
  -p, --port <port>   Override port from config file
  -w, --work-dir <dir>  Specify working directory
  -h, --help          Show this help message

Examples:
  oclb start              # Start in foreground
  oclb start --daemon     # Start in background
  oclb start -p 8080      # Start on port 8080
  oclb start -d -p 3001   # Daemon mode on port 3001
`);
}

/**
 * 执行 start 命令
 * @param {string[]} args - 位置参数
 * @param {Object} options - 命令选项
 */
async function execute(args, options = {}) {
  // 显示帮助
  if (options.help || options.h) {
    showHelp();
    return;
  }

  // 获取工作目录
  const workDir = options['work-dir'] || options.w || process.cwd();
  
  // 初始化进程管理器
  const pm = new ProcessManager({ workDir });

  try {
    // 检查服务是否已在运行
    const status = await pm.status();
    if (status.running) {
      console.log(`✗ Bridge service is already running (PID: ${status.pid})`);
      console.log(`  Use 'oclb status' to check details`);
      process.exit(1);
    }

    // 准备启动参数
    const startOptions = {
      daemon: options.daemon || options.d || false,
      port: options.port || options.p,
      workDir
    };

    // 启动服务
    console.log('Starting OpenCode-Lark Bridge...');
    console.log(`  Working directory: ${workDir}`);
    
    if (startOptions.port) {
      console.log(`  Port: ${startOptions.port}`);
    }
    
    if (startOptions.daemon) {
      console.log('  Mode: daemon (background)');
    } else {
      console.log('  Mode: foreground');
    }

    const result = await pm.start(startOptions);

    if (startOptions.daemon) {
      console.log(`\n✓ Bridge service started successfully`);
      console.log(`  PID: ${result.pid}`);
      console.log(`  Log: ${result.logFile}`);
      console.log(`\nUse 'oclb status' to check service status`);
      console.log(`Use 'oclb logs' to view logs`);
    } else {
      // 前台模式：服务将一直运行直到用户停止
      console.log(`\n✓ Bridge service is running (PID: ${result.pid})`);
      console.log('  Press Ctrl+C to stop\n');
      
      // 设置信号处理
      process.on('SIGINT', async () => {
        console.log('\n\nReceived SIGINT, stopping service...');
        await pm.stop();
        console.log('Service stopped.');
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n\nReceived SIGTERM, stopping service...');
        await pm.stop();
        console.log('Service stopped.');
        process.exit(0);
      });
    }
  } catch (error) {
    console.error(`\n✗ Failed to start bridge service:`, error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = {
  execute,
  showHelp
};
