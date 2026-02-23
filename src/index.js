import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

const require = createRequire(import.meta.url);
const { loadConfig, saveConfig } = require('./config.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Bridge status and module reference
let bridgeStatus = 'idle';
let bridgeModule = null;
let bridgeConfig = {};

// Log storage
const MAX_LOGS = 1000;
const logs = [];
const logEmitter = new EventEmitter();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Logging function
function addLog(level, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  
  logs.push(logEntry);
  
  // Keep only last MAX_LOGS
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  
  // Emit to any connected clients
  logEmitter.emit('log', logEntry);
  
  // Also console log
  console.log(`[${level.toUpperCase()}] ${message}`, data || '');
}

// API Routes

// GET /api/status - Return bridge status
app.get('/api/status', (req, res) => {
  res.json({
    status: bridgeStatus,
    timestamp: new Date().toISOString()
  });
});

// GET /api/config - Return current config
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json(config || bridgeConfig);
});

// POST /api/config - Save config
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    // Validate required fields
    if (!newConfig.feishuAppId || !newConfig.feishuAppSecret) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feishu App ID and Secret are required' 
      });
    }
    
    // Save to file
    const success = saveConfig(newConfig);
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save configuration' 
      });
    }
    
    // Also update in-memory config
    bridgeConfig = { ...bridgeConfig, ...newConfig };
    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Failed to save config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/logs - Get recent logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const recentLogs = logs.slice(-limit);
  res.json(recentLogs);
});

// SSE endpoint for real-time logs
app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendLog = (log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  };
  
  logEmitter.on('log', sendLog);
  
  req.on('close', () => {
    logEmitter.off('log', sendLog);
  });
});

// POST /api/start - Start bridge
app.post('/api/start', async (req, res) => {
  try {
    if (bridgeStatus === 'connected' || bridgeStatus === 'connecting') {
      return res.json({ success: true, status: bridgeStatus, message: 'Bridge already running' });
    }

    bridgeStatus = 'connecting';
    addLog('info', 'Starting bridge...');
    
    // Load config
    const config = loadConfig();
    if (!config || !config.feishuAppId || !config.feishuAppSecret) {
      bridgeStatus = 'error';
      addLog('error', 'Configuration missing. Please configure Feishu App ID and Secret first.');
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration missing. Please configure Feishu App ID and Secret first.' 
      });
    }

    // Dynamically import bridge module
    const { start, getStatus } = await import('./bridge.cjs');
    bridgeModule = { start, getStatus, stop: null };

    addLog('info', 'Initializing bridge modules...');
    
    // Start bridge with config
    await start({
      opencode: {
        workDir: config.workDir || './work',
        port: 4000,
        host: '127.0.0.1'
      },
      feishu: {
        appId: config.feishuAppId,
        appSecret: config.feishuAppSecret,
        chatId: config.feishuChatId || null
      },
      logger: addLog
    });

    bridgeStatus = 'connected';
    addLog('success', 'Bridge started successfully');
    console.log('[Bridge] Started successfully');
    
    res.json({ success: true, status: bridgeStatus });
  } catch (error) {
    console.error('[Bridge] Failed to start:', error);
    bridgeStatus = 'error';
    addLog('error', 'Failed to start bridge: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/stop - Stop bridge
app.post('/api/stop', async (req, res) => {
  try {
    if (bridgeStatus === 'idle') {
      return res.json({ success: true, status: bridgeStatus, message: 'Bridge already stopped' });
    }

    addLog('info', 'Stopping bridge...');
    
    // Dynamically import bridge module to get stop function
    try {
      const bridge = await import('./bridge.cjs');
      if (bridge && bridge.stop) {
        await bridge.stop();
        addLog('info', 'Bridge module stopped');
      }
    } catch (importError) {
      addLog('warn', 'Could not import bridge module for stop: ' + importError.message);
    }

    bridgeStatus = 'idle';
    bridgeModule = null;
    addLog('info', 'Bridge stopped successfully');
    console.log('[Bridge] Stopped successfully');
    
    res.json({ success: true, status: bridgeStatus });
  } catch (error) {
    console.error('[Bridge] Failed to stop:', error);
    addLog('error', 'Failed to stop bridge: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kill-opencode - Kill opencode process by port
app.post('/api/kill-opencode', async (req, res) => {
  try {
    const { port } = req.body;
    const targetPort = parseInt(port);

    if (!port || isNaN(targetPort)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid port number'
      });
    }

    // Prevent killing the bridge server itself
    if (targetPort === PORT) {
      addLog('warn', `Attempted to kill bridge server port ${PORT} - operation blocked`);
      return res.status(403).json({
        success: false,
        error: `Cannot kill the bridge server port ${PORT}`
      });
    }

    addLog('info', `Attempting to kill opencode process on port ${port}`);

    // Find and kill process using the port
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    let killed = false;
    let processInfo = '';

    try {
      const platform = process.platform;

      if (platform === 'darwin' || platform === 'linux') {
        // macOS/Linux: Find PID by port and check process name
        const { stdout } = await execAsync(`lsof -ti:${port} || echo ''`);
        const pids = stdout.trim().split('\n').filter(pid => pid);
        
        for (const pid of pids) {
          try {
            const { stdout: cmdStdout } = await execAsync(`ps -p ${pid} -o comm= 2>/dev/null || echo ''`);
            const processName = cmdStdout.trim();
            
            if (processName && processName.toLowerCase().includes('opencode')) {
              await execAsync(`kill -9 ${pid}`);
              killed = true;
              if (!processInfo) {
                processInfo = `Found PIDs: `;
              } else {
                processInfo += ', ';
              }
              processInfo += `PID ${pid} (${processName})`;
              addLog('info', `Killed opencode process: ${processName} (PID ${pid})`);
            } else {
              addLog('warn', `Skipped non-opencode process: ${processName || 'unknown'} (PID ${pid})`);
            }
          } catch (checkErr) {
            addLog('warn', `Failed to check process ${pid}: ${checkErr.message}`);
          }
        }
      } else if (platform === 'win32') {
        // Windows: Find PID by port and kill
        const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
        const lines = stdout.trim().split('\n').filter(line => line);

        if (lines.length > 0) {
          const pids = [...new Set(lines.map(line => line.trim().split(/\s+/).pop()))];
          processInfo = `Found PIDs: ${pids.join(', ')}`;

          for (const pid of pids) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              killed = true;
            } catch (killErr) {
              addLog('warn', `Failed to kill PID ${pid}: ${killErr.message}`);
            }
          }
        }
      }
    } catch (findErr) {
      // No process found or command failed
      processInfo = `No process found on port ${port}`;
    }

    if (killed) {
      addLog('success', `Successfully killed opencode process on port ${port}. ${processInfo}`);
      res.json({
        success: true,
        message: `Process on port ${port} killed successfully`,
        details: processInfo
      });
    } else {
      addLog('info', `No process found to kill on port ${port}`);
      res.json({
        success: true,
        message: `No process found on port ${port}`,
        details: processInfo
      });
    }
  } catch (error) {
    console.error('Failed to kill opencode process:', error);
    addLog('error', 'Failed to kill opencode process: ' + error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Feishu-OpenCode Bridge server running on http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop`);
});

export default app;
