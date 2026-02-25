/**
 * Logs Command - 查看桥接服务日志
 * 
 * 使用方法:
 *   oclb logs [options]
 * 
 * 选项:
 *   --work-dir, -w    指定工作目录
 *   --lines, -n       显示的行数 (默认: 50)
 *   --follow, -f      持续跟踪日志输出 (类似 tail -f)
 *   --since, -s       显示自某个时间开始的日志 (格式: 1h, 30m, 1d)
 *   --level, -l       过滤日志级别 (error, warn, info, debug)
 * 
 * 示例:
 *   oclb logs
 *   oclb logs -n 100
 *   oclb logs -f
 *   oclb logs --since 1h -l error
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ProcessManager = require('../../lib/process-manager.cjs');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Usage: oclb logs [options]

View logs from the OpenCode-Lark Bridge service

Options:
  -w, --work-dir <dir>  Specify working directory
  -n, --lines <num>     Number of lines to show (default: 50)
  -f, --follow          Follow log output (like tail -f)
  -s, --since <time>    Show logs since (e.g., 1h, 30m, 1d)
  -l, --level <level>   Filter by log level (error, warn, info, debug)
  -h, --help            Show this help message

Examples:
  oclb logs                    # Show last 50 lines
  oclb logs -n 100            # Show last 100 lines
  oclb logs -f                # Follow logs in real-time
  oclb logs -s 1h             # Show last hour
  oclb logs -l error          # Show only errors
  oclb logs -f -l info        # Follow info+ logs
`);
}

/**
 * 解析时间字符串为毫秒
 * @param {string} timeStr - 时间字符串 (如 "1h", "30m", "1d")
 * @returns {number} 毫秒数
 */
function parseTime(timeStr) {
  const match = timeStr.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return null;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * 过滤日志行
 * @param {string[]} lines - 日志行数组
 * @param {Object} options - 过滤选项
 * @returns {string[]} 过滤后的日志行
 */
function filterLogs(lines, options = {}) {
  let filtered = lines;
  
  // 按时间过滤
  if (options.since) {
    const cutoffTime = Date.now() - options.since;
    filtered = filtered.filter(line => {
      // 尝试从日志行解析时间戳
      // 假设格式如: "2025-01-15 10:30:45 [INFO] message"
      const match = line.match(/^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
      if (match) {
        const logTime = new Date(match[1]).getTime();
        return logTime >= cutoffTime;
      }
      return true; // 无法解析时间的行保留
    });
  }
  
  // 按日志级别过滤
  if (options.level) {
    const level = options.level.toLowerCase();
    const levelPattern = new RegExp(`\\[${level}\\]`, 'i');
    filtered = filtered.filter(line => levelPattern.test(line));
  }
  
  return filtered;
}

/**
 * 读取日志文件
 * @param {string} logPath - 日志文件路径
 * @param {number} lines - 要读取的行数
 * @returns {Promise<string[]>} 日志行数组
 */
async function readLogFile(logPath, lines = 50) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(logPath)) {
      resolve([]);
      return;
    }

    // 使用 tail 命令获取最后 N 行
    const tail = spawn('tail', ['-n', lines.toString(), logPath]);
    let output = '';
    let error = '';

    tail.stdout.on('data', (data) => {
      output += data.toString();
    });

    tail.stderr.on('data', (data) => {
      error += data.toString();
    });

    tail.on('close', (code) => {
      if (code !== 0 && error) {
        reject(new Error(error));
      } else {
        const lines = output.split('\n').filter(line => line.length > 0);
        resolve(lines);
      }
    });

    tail.on('error', (err) => {
      // 如果 tail 命令不可用，使用 Node.js 读取
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.split('\n');
        const lastLines = allLines.slice(-lines).filter(line => line.length > 0);
        resolve(lastLines);
      } catch (readErr) {
        reject(readErr);
      }
    });
  });
}

/**
 * 跟踪日志输出 (类似 tail -f)
 * @param {string} logPath - 日志文件路径
 * @param {Object} options - 选项
 */
async function followLogs(logPath, options = {}) {
  if (!fs.existsSync(logPath)) {
    console.log(`Log file does not exist yet: ${logPath}`);
    console.log('Logs will appear here once the service starts writing...\n');
  }

  // 使用 tail -f 命令
  const args = ['-f'];
  
  // 从指定行数开始
  if (options.lines) {
    args.push('-n', options.lines.toString());
  }
  
  args.push(logPath);

  console.log(`Following logs: ${logPath}`);
  console.log('Press Ctrl+C to stop\n');

  const tail = spawn('tail', args, {
    stdio: 'inherit'
  });

  return new Promise((resolve) => {
    tail.on('close', (code) => {
      resolve();
    });
  });
}

/**
 * 执行 logs 命令
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
  
  // 确定日志文件路径
  let logPath = path.join(workDir, 'bridge.log');
  
  // 如果服务正在运行，使用运行中的配置
  try {
    const status = await pm.status();
    if (status.running && status.logFile) {
      logPath = status.logFile;
    }
  } catch (err) {
    // 忽略状态检查错误
  }

  // 处理 --follow 模式
  if (options.follow || options.f) {
    await followLogs(logPath, {
      lines: options.lines || options.n || 10
    });
    return;
  }

  // 普通模式：读取并显示日志
  try {
    const lines = options.lines || options.n || 50;
    
    console.log(`Reading logs from: ${logPath}`);
    console.log(`Lines: ${lines}\n`);

    // 读取日志
    const logLines = await readLogFile(logPath, lines);

    if (logLines.length === 0) {
      console.log('No log entries found.');
      console.log('The service may not have started yet, or the log file is empty.');
      return;
    }

    // 过滤日志
    const filterOptions = {};
    if (options.since || options.s) {
      const timeMs = parseTime(options.since || options.s);
      if (timeMs) {
        filterOptions.since = timeMs;
      }
    }
    if (options.level || options.l) {
      filterOptions.level = options.level || options.l;
    }

    const filteredLines = filterLogs(logLines, filterOptions);

    // 显示日志
    console.log('─'.repeat(80));
    filteredLines.forEach(line => {
      console.log(line);
    });
    console.log('─'.repeat(80));

    console.log(`\nDisplayed ${filteredLines.length} of ${logLines.length} log entries`);
    
    // 显示提示
    console.log('\nTips:');
    console.log('  Use --follow (-f) to stream logs in real-time');
    console.log('  Use --lines (-n) to show more lines');
    console.log('  Use --since (-s) to filter by time (e.g., 1h, 30m)');
    console.log('  Use --level (-l) to filter by log level\n');
  } catch (error) {
    console.error(`\n✗ Failed to read logs:`, error.message);
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
