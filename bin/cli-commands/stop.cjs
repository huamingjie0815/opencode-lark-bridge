/**
 * Stop Command - 停止桥接服务
 * 
 * 使用方法:
 *   oclb stop [options]
 * 
 * 选项:
 *   --force, -f    强制停止 (发送 SIGKILL)
 *   --work-dir, -w 指定工作目录
 * 
 * 示例:
 *   oclb stop
 *   oclb stop --force
 *   oclb stop -f -w /path/to/workspace
 */

const ProcessManager = require('../../lib/process-manager.cjs');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Usage: oclb stop [options]

Stop the Feishu-OpenCode bridge service

Options:
  -f, --force       Force stop (send SIGKILL)
  -w, --work-dir <dir>  Specify working directory
  -h, --help        Show this help message

Examples:
  oclb stop              # Graceful stop
  oclb stop --force      # Force kill
  oclb stop -f           # Short option
`);
}

/**
 * 执行 stop 命令
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
    // 检查服务状态
    const status = await pm.status();
    
    if (!status.running) {
      console.log('✗ Bridge service is not running');
      if (status.pid) {
        console.log(`  Stale PID file found: ${status.pidFile}`);
        console.log('  Cleaning up...');
        await pm.cleanup();
        console.log('  Done');
      }
      return;
    }

    console.log('Stopping OpenCode-Lark Bridge...');
    console.log(`  PID: ${status.pid}`);
    console.log(`  Work directory: ${workDir}`);
    
    if (options.force || options.f) {
      console.log('  Mode: force (SIGKILL)');
    } else {
      console.log('  Mode: graceful (SIGTERM)');
    }

    // 执行停止操作
    const result = await pm.stop({
      force: options.force || options.f || false
    });

    if (result.success) {
      console.log('\n✓ Bridge service stopped successfully');
      if (result.message) {
        console.log(`  ${result.message}`);
      }
    } else {
      console.log('\n✗ Failed to stop bridge service');
      if (result.message) {
        console.log(`  ${result.message}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Error stopping bridge service:`, error.message);
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
