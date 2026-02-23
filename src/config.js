import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG_PATH = '.config.json';

export const defaultConfig = {
  feishuAppId: '',
  feishuAppSecret: '',
  feishuChatId: '',
  workDir: './work',
  bridgePort: 3000
};

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { ...defaultConfig, ...config };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Invalid JSON in config file: ${configPath}`);
    } else {
      console.error(`Error loading config: ${error.message}`);
    }
    return null;
  }
}

function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  try {
    const dir = path.dirname(configPath);
    if (dir && !fs.existsSync(dir)) {
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
