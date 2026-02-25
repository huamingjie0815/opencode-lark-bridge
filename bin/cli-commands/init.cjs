/**
 * Init Command - 初始化桥接服务配置
 * 
 * 使用方法:
 *   oclb init [options]
 * 
 * 选项:
 *   --work-dir, -w    指定工作目录 (默认为当前目录)
 *   --force, -f       强制覆盖现有配置
 * 
 * 示例:
 *   oclb init
 *   oclb init -w /path/to/workspace
 *   oclb init --force
 */

const fs = require('fs');
const path = require('path');

/**
 * 默认配置模板
 * 生成一个新的配置文件内容
 */
const DEFAULT_CONFIG = {
  // 飞书应用配置
  feishuAppId: '',
  feishuAppSecret: '',
  
  // 服务器配置
  bridgePort: 3000,
  workDir: process.cwd(),
  
  // OpenCode 配置
  opencodePath: 'opencode',
  
  // 日志配置
  logLevel: 'info',
  logFile: 'bridge.log',
  
  // 高级配置
  maxRetries: 3,
  retryDelay: 5000,
  heartbeatInterval: 30000
};

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Usage: oclb init [options]

Initialize configuration for OpenCode-Lark Bridge

Options:
  -w, --work-dir <dir>  Specify working directory (default: current directory)
  -f, --force           Force overwrite existing configuration
  -h, --help            Show this help message

Examples:
  oclb init                  # Initialize in current directory
  oclb init -w /path/to/ws  # Initialize in specified directory
  oclb init --force         # Overwrite existing config
`);
}

/**
 * 检查目录是否存在，不存在则创建
 * @param {string} dir - 目录路径
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 创建配置文件
 * @param {string} configPath - 配置文件路径
 * @param {Object} config - 配置对象
 */
function createConfigFile(configPath, config) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    'utf8'
  );
}

/**
 * 交互式询问配置值
 * 这里简化处理，实际可以实现 readline 交互
 */
async function interactiveConfig() {
  const config = { ...DEFAULT_CONFIG };
  
  // 在这里可以添加交互式配置逻辑
  // 例如使用 readline 模块询问用户输入
  
  return config;
}

/**
 * 执行 init 命令
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
  const configPath = path.join(workDir, '.config.json');

  console.log('Initializing OpenCode-Lark Bridge...');
  console.log(`  Working directory: ${workDir}`);
  console.log(`  Config file: ${configPath}`);

  try {
    // 确保工作目录存在
    ensureDirectory(workDir);

    // 检查配置文件是否已存在
    if (fs.existsSync(configPath)) {
      if (options.force || options.f) {
        console.log('  Overwriting existing configuration (--force)');
      } else {
        console.log('\n✗ Configuration file already exists');
        console.log(`  ${configPath}`);
        console.log('\nUse --force to overwrite, or edit the file directly.');
        process.exit(1);
      }
    }

    // 准备配置内容
    const config = await interactiveConfig();
    
    // 根据命令行选项更新配置
    config.workDir = workDir;
    if (options.port || options.p) {
      config.bridgePort = parseInt(options.port || options.p, 10);
    }

    // 写入配置文件
    createConfigFile(configPath, config);

    console.log('\n✓ Configuration initialized successfully');
    console.log(`  Config file: ${configPath}`);
    console.log('\nNext steps:');
    console.log('  1. Edit the configuration file with your credentials');
    console.log('  2. Run "oclb start" to start the service');
    console.log('  3. Run "oclb status" to check status\n');
  } catch (error) {
    console.error('\n✗ Failed to initialize configuration:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = {
  execute,
  showHelp,
  DEFAULT_CONFIG
};
