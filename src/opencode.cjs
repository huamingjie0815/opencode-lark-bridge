const { spawn } = require('child_process');
const http = require('http');
const { EventEmitter } = require('events');

class OpenCodeClient extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.config = null;
    this.sessionId = null;
    this.eventSource = null;
    this.connected = false;
    this.healthCheckInterval = null;
    this.eventSourceController = null;
  }

  async start(config) {
    return new Promise((resolve, reject) => {
      this.config = config;
      const { workDir, port, host } = config;

      const args = [
        'serve',
        '--port', port.toString(),
        '--hostname', host
      ];

      this.process = spawn('opencode', args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });

      let stderr = '';
      this.process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      this.process.on('error', (error) => {
        reject(new Error(`Failed to start opencode: ${error.message}`));
      });

      this.process.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          this.emit('error', new Error(`Process exited with code ${code}: ${stderr}`));
        }
        this.connected = false;
        this.emit('disconnected');
      });

      this._waitForHealth(host, port, 30000)
        .then(() => {
          this.connected = true;
          this._startHealthPolling(host, port);
          resolve();
        })
        .catch((error) => {
          this.stop().catch(() => {});
          reject(error);
        });
    });
  }

  async _waitForHealth(host, port, timeoutMs) {
    const startTime = Date.now();
    const checkInterval = 500;

    return new Promise((resolve, reject) => {
      const check = () => {
        const req = http.get(`http://${host}:${port}/global/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        });

        req.on('error', retry);
        req.setTimeout(checkInterval, () => {
          req.destroy();
          retry();
        });
      };

      const retry = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Health check timeout'));
        } else {
          setTimeout(check, checkInterval);
        }
      };

      check();
    });
  }

  _startHealthPolling(host, port) {
    this.healthCheckInterval = setInterval(() => {
      const req = http.get(`http://${host}:${port}/global/health`, (res) => {
        if (res.statusCode !== 200 && this.connected) {
          this.connected = false;
          this.emit('disconnected');
        }
      });

      req.on('error', () => {
        if (this.connected) {
          this.connected = false;
          this.emit('disconnected');
        }
      });
    }, 5000);
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.eventSourceController) {
        this.eventSourceController.abort();
        this.eventSourceController = null;
      }

      this.connected = false;

      if (!this.process) {
        resolve();
        return;
      }

      const pid = this.process.pid;
      let killed = false;

      // Kill the entire process group (including child processes)
      try {
        process.kill(-pid, 'SIGTERM');
      } catch (e) {
        // If killing process group fails, try killing the main process
        this.process.kill('SIGTERM');
      }

      const timeout = setTimeout(() => {
        if (!killed) {
          try {
            // Force kill the entire process group
            process.kill(-pid, 'SIGKILL');
          } catch (e) {
            try {
              // Fallback: kill just the main process
              process.kill(pid, 'SIGKILL');
            } catch (e2) {
              // Process might already be dead
            }
          }
        }
        killed = true;
        resolve();
      }, 5000);

      this.process.on('exit', () => {
        if (!killed) {
          killed = true;
          clearTimeout(timeout);
          this.process = null;
          resolve();
        }
      });
    });
  }

  async createSession() {
    return new Promise((resolve, reject) => {
      const { host, port } = this.config;
      const postData = JSON.stringify({});

      const options = {
        hostname: host,
        port: port,
        path: '/session',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('[OpenCode DEBUG] createSession response data:', data);
          try {
            const response = JSON.parse(data);
            console.log('[OpenCode DEBUG] parsed response:', response);
            // OpenCode returns 'id' instead of 'sessionId'
            const sessionId = response.sessionId || response.id;
            if (sessionId) {
              this.sessionId = sessionId;
              console.log('[OpenCode DEBUG] Session created:', sessionId);
              resolve(sessionId);
            } else {
              console.error('[OpenCode DEBUG] No sessionId or id in response:', response);
              reject(new Error('No sessionId in response'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async sendMessage(sessionId, text) {
    return new Promise((resolve, reject) => {
      const { host, port } = this.config;
      const postData = JSON.stringify({ parts: [{ type: 'text', text }] });

      const options = {
        hostname: host,
        port: port,
        path: `/session/${sessionId}/message`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log('[OpenCode DEBUG] sendMessage request:', { path: options.path, postData, sessionId });
      
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          console.log('[OpenCode DEBUG] sendMessage response:', res.statusCode, responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Parse response and emit message event so bridge can forward to Feishu
            try {
              const parsedResponse = JSON.parse(responseData);
              if (parsedResponse.parts || parsedResponse.text) {
                this.emit('message', parsedResponse);
              }
            } catch (e) {
              // Ignore parse errors
            }
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async getEventStream() {
    return new Promise((resolve, reject) => {
      if (this.eventSourceController) {
        resolve();
        return;
      }

      const { host, port } = this.config;
      const controller = new AbortController();
      this.eventSourceController = controller;

      const options = {
        hostname: host,
        port: port,
        path: '/event',
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        res.setEncoding('utf8');

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = null;
          let currentData = null;

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentEvent) {
              this._handleSSEEvent(currentEvent, currentData);
              currentEvent = null;
              currentData = null;
            }
          }
        });

        res.on('end', () => {
          this.eventSourceController = null;
          this.emit('disconnected');
        });

        resolve();
      });

      req.on('error', (err) => {
        this.eventSourceController = null;
        reject(err);
      });

      controller.signal.addEventListener('abort', () => {
        req.destroy();
      });

      req.end();
    });
  }

  _handleSSEEvent(event, data) {
    try {
      const parsed = data ? JSON.parse(data) : null;

      switch (event) {
        case 'connected':
          this.emit('connected', parsed);
          break;
        case 'message':
          this.emit('message', parsed);
          break;
        case 'disconnected':
          this.emit('disconnected', parsed);
          break;
        case 'error':
          this.emit('error', new Error(parsed?.message || 'Unknown error'));
          break;
        default:
          this.emit(event, parsed);
      }
    } catch (e) {
      this.emit(event, data);
    }
  }

  getState() {
    return {
      connected: this.connected,
      sessionId: this.sessionId,
      processRunning: !!this.process && !this.process.killed
    };
  }
}

const client = new OpenCodeClient();

module.exports = {
  OpenCodeClient,
  start: (config) => client.start(config),
  stop: () => client.stop(),
  createSession: () => client.createSession(),
  sendMessage: (sessionId, text) => client.sendMessage(sessionId, text),
  on: (event, handler) => client.on(event, handler),
  off: (event, handler) => client.off(event, handler),
  getEventStream: () => client.getEventStream(),
  getState: () => client.getState(),
  _client: client
};
