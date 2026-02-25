/**
 * Status Command - 查看桥接服务状态
 * 
 * 使用方法:
 *   oclb status [options]
 * 
 * 选项:
 *   --work-dir, -w    指定工作目录
 *   --json, -j        以 JSON 格式输出
 * 
 * 示例:
 *   oclb status
 *   oclb status -w /path/to/workspace
 *   oclb status --json
 */

const ProcessManager = require('../../lib/process-manager.cjs');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Usage: oclb status [options]

Check the status of OpenCode-Lark Bridge service

Options:
  -w, --work-dir <dir>  Specify working directory
  -j, --json            Output in JSON format
  -h, --help            Show this help message

Examples:
  oclb status                # Show status
  oclb status -w /path/to/ws # Check specific workspace
  oclb status --json         # JSON output
`);
}

/**
 * 格式化运行时间
 * @param {number} seconds - 运行秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatUptime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}

/**
 * 执行 status 命令
 * @param {string[]} args - 位置参数
 * @param {Object} options - 命令选项
 */
async function execute(args, options = {}) {
  // 显示帮助
  if (options.help || options.h) {
    showHelp();
    return;
  }

  // 确定工作目录
  const workDir = options['work-dir'] || options.w || process.cwd();
  
  // 初始化进程管理器
  const pm = new ProcessManager({ workDir });

  try {
    // 获取状态
    const status = await pm.status();

    // JSON 格式输出
    if (options.json || options.j) {
      console.log(JSON.stringify({
        running: status.running,
        pid: status.pid || null,
        uptime: status.uptime || null,
        uptimeFormatted: status.uptime ? formatUptime(status.uptime) : null,
        pidFile: status.pidFile || null,
        workDir: workDir,
        timestamp: new Date().toISOString()
      }, null, 2));
      return;
    }

    // 文本格式输出
    console.log('\nOpenCode-Lark Bridge Status');
    console.log('═══════════════════════════════\n');
    
    if (status.running) {
      console.log('  Status:    ● Running');
      console.log(`  PID:       ${status.pid}`);
      if (status.uptime) {
        console.log(`  Uptime:    ${formatUptime(status.uptime)}`);
      }
    } else {
      console.log('  Status:    ○ Stopped');
      
      // 如果有遗留的 PID 文件，提示清理
      if (status.pid) {
        console.log(`\n  ⚠ Stale PID file found: ${status.pid}`);
        console.log('    Run with --force to clean up');
      }
    }
    
    console.log(`\n  Work Dir:  ${workDir}`);
    if (status.pidFile) {
      console.log(`  PID File:  ${status.pidFile}`);
    }
    
    console.log('\n═══════════════════════════════\n');
    
    // 显示可用的后续操作
    if (status.running) {
      console.log('Useful commands:');
      console.log('  oclb stop       Stop the service');
      console.log('  oclb logs       View logs');
      console.log('  oclb status     Refresh status\n');
    } else {
      console.log('Useful commands:');
      console.log('  oclb start      Start the service');
      console.log('  oclb init       Initialize configuration\n');
    }
  } catch (error) {
    console.error('\n✗ Failed to get status:', error.message);
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
