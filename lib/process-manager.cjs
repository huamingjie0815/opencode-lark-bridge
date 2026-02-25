/**
 * Process Manager - 进程管理工具
 * 
 * 提供进程管理功能，包括：
 * - 启动/停止服务
 * - 进程状态检查
 * - PID 文件管理
 * - 日志文件管理
 * 
 * @module process-manager
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * ProcessManager 类
 * 用于管理 Feishu-OpenCode Bridge 服务的生命周期
 */
class ProcessManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.workDir - 工作目录 (默认: 当前目录)
   * @param {string} options.pidFile - PID 文件路径 (默认: workDir/.bridge.pid)
   * @param {string} options.logFile - 日志文件路径 (默认: workDir/bridge.log)
   */
  constructor(options = {}) {
    this.workDir = options.workDir || process.cwd();
    this.pidFile = options.pidFile || path.join(this.workDir, '.bridge.pid');
    this.logFile = options.logFile || path.join(this.workDir, 'bridge.log');
  }

  /**
   * 检查进程是否在运行
   * @param {number} pid - 进程 ID
   * @returns {boolean} 进程是否在运行
   */
  _isProcessRunning(pid) {
    try {
      // 向进程发送信号 0 来检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 读取 PID 文件
   * @returns {number|null} 进程 ID 或 null
   */
  _readPidFile() {
    try {
      if (fs.existsSync(this.pidFile)) {
        const pid = parseInt(fs.readFileSync(this.pidFile, 'utf8').trim(), 10);
        return isNaN(pid) ? null : pid;
      }
    } catch (error) {
      // 读取失败，返回 null
    }
    return null;
  }

  /**
   * 写入 PID 文件
   * @param {number} pid - 进程 ID
   */
  _writePidFile(pid) {
    try {
      fs.writeFileSync(this.pidFile, pid.toString(), 'utf8');
    } catch (error) {
      throw new Error(`Failed to write PID file: ${error.message}`);
    }
  }

  /**
   * 删除 PID 文件
   */
  _removePidFile() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
      }
    } catch (error) {
      // 删除失败，忽略错误
    }
  }

  /**
   * 获取服务状态
   * @returns {Promise<Object>} 状态对象
   * @property {boolean} running - 服务是否运行中
   * @property {number} [pid] - 进程 ID
   * @property {number} [uptime] - 运行时间(秒)
   * @property {string} [pidFile] - PID 文件路径
   */
  async status() {
    const pid = this._readPidFile();
    
    if (pid && this._isProcessRunning(pid)) {
      // 获取进程启动时间
      let uptime = null;
      try {
        // 在 macOS/Linux 上使用 ps 命令获取进程启动时间
        const { stdout } = await execAsync(`ps -p ${pid} -o etimes=`);
        uptime = parseInt(stdout.trim(), 10);
      } catch (err) {
        // 如果无法获取运行时间，返回 null
      }

      return {
        running: true,
        pid: pid,
        uptime: uptime,
        pidFile: this.pidFile
      };
    }

    // PID 文件存在但进程不在运行，说明是残留文件
    return {
      running: false,
      pid: pid || null,
      pidFile: pid ? this.pidFile : null
    };
  }

  /**
   * 启动服务
   * @param {Object} options - 启动选项
   * @param {boolean} options.daemon - 是否以守护进程模式运行
   * @param {number} [options.port] - 覆盖端口号
   * @param {string} [options.workDir] - 工作目录
   * @returns {Promise<Object>} 启动结果
   * @property {number} pid - 进程 ID
   * @property {string} logFile - 日志文件路径
   */
  async start(options = {}) {
    const daemon = options.daemon || false;
    const workDir = options.workDir || this.workDir;

    // 构建启动参数
    const scriptPath = path.join(__dirname, '..', 'src', 'index.js');
    const nodeArgs = [scriptPath];

    // 如果指定了端口，添加到环境变量
    const env = {
      ...process.env,
      BRIDGE_WORK_DIR: workDir
    };
    
    if (options.port) {
      env.BRIDGE_PORT = options.port.toString();
    }

    if (daemon) {
      // 守护进程模式：后台运行
      return new Promise((resolve, reject) => {
        // 使用 nohup 或类似的机制确保进程在后台运行
        const out = fs.openSync(this.logFile, 'a');
        const err = fs.openSync(this.logFile, 'a');

        const child = spawn(process.execPath, nodeArgs, {
          detached: true,
          stdio: ['ignore', out, err],
          env,
          cwd: workDir
        });

        child.unref();

        // 等待一小段时间确保进程成功启动
        setTimeout(async () => {
          if (this._isProcessRunning(child.pid)) {
            // 写入 PID 文件
            this._writePidFile(child.pid);
            
            resolve({
              pid: child.pid,
              logFile: this.logFile
            });
          } else {
            reject(new Error('Process failed to start'));
          }
        }, 500);
      });
    } else {
      // 前台模式：在当前进程运行，同时输出到终端和写入日志
      return new Promise((resolve, reject) => {
        // 确保日志目录存在
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        // 创建日志写入流（追加模式）
        const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        
        const child = spawn(process.execPath, nodeArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
          cwd: workDir
        });

        // 写入 PID 文件
        this._writePidFile(child.pid);

        // 处理 stdout：同时输出到终端和写入日志
        child.stdout.on('data', (data) => {
          process.stdout.write(data);
          logStream.write(data);
        });

        // 处理 stderr：同时输出到终端和写入日志
        child.stderr.on('data', (data) => {
          process.stderr.write(data);
          logStream.write(data);
        });

        // 监听进程退出
        child.on('exit', (code) => {
          logStream.end();
          this._removePidFile();
          if (code !== 0) {
            reject(new Error(`Process exited with code ${code}`));
          }
        });

        // 返回进程信息
        resolve({
          pid: child.pid,
          logFile: this.logFile
        });
      });
    }
  }

  /**
   * 停止服务
   * @param {Object} options - 停止选项
   * @param {boolean} options.force - 是否强制停止 (使用 SIGKILL)
   * @returns {Promise<Object>} 停止结果
   * @property {boolean} success - 是否成功停止
   * @property {string} message - 结果消息
   */
  /**
   * 停止服务
   * @param {Object} options - 停止选项
   * @param {boolean} options.force - 是否强制停止 (使用 SIGKILL)
   * @returns {Promise<Object>} 停止结果
   * @property {boolean} success - 是否成功停止
   * @property {string} message - 结果消息
   */
  async stop(options = {}) {
    const force = options.force || false;
    
    const status = await this.status();
    
    if (!status.running) {
      // 清理残留的 PID 文件
      if (status.pid) {
        this._removePidFile();
        return {
          success: true,
          message: 'Cleaned up stale PID file'
        };
      }
      
      return {
        success: true,
        message: 'Service is not running'
      };
    }

    const pid = status.pid;
    const signal = force ? 'SIGKILL' : 'SIGTERM';

    return new Promise((resolve, reject) => {
      // 发送信号
      try {
        process.kill(pid, signal);
      } catch (error) {
        reject(new Error(`Failed to send ${signal} to process ${pid}: ${error.message}`));
        return;
      }

      // 等待进程退出
      let attempts = 0;
      const maxAttempts = force ? 5 : 30; // 强制模式等待时间短
      const interval = setInterval(() => {
        attempts++;
        
        if (!this._isProcessRunning(pid)) {
          // 进程已退出
          clearInterval(interval);
          this._removePidFile();
          resolve({
            success: true,
            message: force ? 'Process killed' : 'Process stopped gracefully'
          });
          return;
        }

        if (attempts >= maxAttempts) {
          // 超时
          clearInterval(interval);
          if (force) {
            resolve({
              success: false,
              message: 'Process did not terminate after SIGKILL'
            });
          } else {
            resolve({
              success: false,
              message: 'Process did not terminate gracefully, use --force'
            });
          }
        }
      }, 1000);
    });
  }

  /**
   * 清理残留的 PID 文件
   */
  cleanup() {
    const pid = this._readPidFile();
    if (pid && !this._isProcessRunning(pid)) {
      this._removePidFile();
      return true;
    }
    return false;
  }
}

module.exports = ProcessManager;