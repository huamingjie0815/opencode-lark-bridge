import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG_PATH = '.config.json';

// 项目根目录
const PROJECT_ROOT = process.cwd();

/**
 * 获取配置文件路径
 * @param {string} workDir - 工作目录
 * @returns {string} 配置文件路径
 */
function getConfigPath(workDir) {
  if (workDir) {
    // 使用工作目录下的配置
    return path.join(workDir, DEFAULT_CONFIG_PATH);
  }
  // 默认使用项目根目录
  return path.join(PROJECT_ROOT, DEFAULT_CONFIG_PATH);
}

export const defaultConfig = {
  feishuAppId: '',
  feishuAppSecret: '',
  feishuChatId: '',
  workDir: './work',
  bridgePort: 3000
};

function loadConfig(workDir) {
  try {
    const configPath = getConfigPath(workDir);
    
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { ...defaultConfig, ...config };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Invalid JSON in config file`);
    } else {
      console.error(`Error loading config: ${error.message}`);
    }
    return null;
  }
}

function saveConfig(config, workDir) {
  try {
    const configPath = getConfigPath(workDir);
    const dir = path.dirname(configPath);
    
    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error saving config: ${error.message}`);
    return false;
  }
}

function validateConfig(config) {
  const errors = [];

  if (!config) {
    return { valid: false, errors: ['Config is null or undefined'] };
  }

  if (!config.feishuAppId || typeof config.feishuAppId !== 'string' || config.feishuAppId.trim() === '') {
    errors.push('feishuAppId is required and must be a non-empty string');
  }

  if (!config.feishuAppSecret || typeof config.feishuAppSecret !== 'string' || config.feishuAppSecret.trim() === '') {
    errors.push('feishuAppSecret is required and must be a non-empty string');
  }

  if (!config.workDir || typeof config.workDir !== 'string' || config.workDir.trim() === '') {
    errors.push('workDir is required and must be a non-empty string');
  }

  if (config.bridgePort !== undefined) {
    if (typeof config.bridgePort !== 'number' || config.bridgePort < 1 || config.bridgePort > 65535) {
      errors.push('bridgePort must be a number between 1 and 65535');
    }
  }

  if (config.feishuChatId !== undefined && config.feishuChatId !== '') {
    if (typeof config.feishuChatId !== 'string') {
      errors.push('feishuChatId must be a string');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export { loadConfig, saveConfig, validateConfig };
