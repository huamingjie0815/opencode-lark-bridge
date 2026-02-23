/**
 * Bridge Module - Message Queue and Integration Layer
 * 
 * Integrates OpenCode and Feishu modules, providing:
 * - FIFO message queue for reliable message handling
 * - Bridge state management (idle, connecting, connected, error)
 * - Bidirectional message flow (Feishu ↔ OpenCode)
 * - Express API integration support
 */

const { EventEmitter } = require('events');
const opencode = require('./opencode.cjs');
const feishuModule = require('./feishu.js');
const feishu = feishuModule.default || feishuModule;

// Status constants
const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// Internal state
let currentStatus = STATUS.IDLE;
let errorMessage = null;
let connectionStartTime = null;
let lastErrorTime = null;

// Module connection states
let feishuConnected = false;
let opencodeConnected = false;

// Session management
let sessionId = null;
let chatIdToSessionMap = new Map();

// Logger function (injected from index.js)
let logger = null;

// Event emitter for bridge events
const eventEmitter = new EventEmitter();

// Event handlers storage
const eventHandlers = {
  message: [],
  statusChange: [],
  error: []
};

/**
 * ============================================
 * FIFO MESSAGE QUEUE
 * ============================================
 */

const MAX_QUEUE_SIZE = 100;
const messageQueue = [];

function enqueue(message) {
  if (messageQueue.length >= MAX_QUEUE_SIZE) {
    messageQueue.shift();
  }
  messageQueue.push(message);
  return true;
}

function dequeue() {
  if (messageQueue.length === 0) {
    return null;
  }
  return messageQueue.shift();
}

function isEmpty() {
  return messageQueue.length === 0;
}

function size() {
  return messageQueue.length;
}

function clear() {
  messageQueue.length = 0;
}

/**
 * ============================================
 * BRIDGE STATE MANAGEMENT
 * ============================================
 */

function setStatus(status, error = null) {
  const oldStatus = currentStatus;
  currentStatus = status;
  
  if (status === STATUS.ERROR) {
    errorMessage = error || 'Unknown error';
    lastErrorTime = Date.now();
    if (logger) logger('error', `Bridge status changed to ERROR: ${errorMessage}`);
  } else if (status === STATUS.CONNECTED) {
    errorMessage = null;
    if (logger) logger('info', `Bridge status changed to CONNECTED`);
  } else {
    if (logger) logger('info', `Bridge status changed from ${oldStatus} to ${status}`);
  }

  emitEvent('statusChange', { 
    oldStatus, 
    newStatus: status, 
    error: errorMessage 
  });
}

function updateConnectionStatus() {
  if (feishuConnected && opencodeConnected) {
    if (currentStatus !== STATUS.CONNECTED) {
      setStatus(STATUS.CONNECTED);
    }
  } else if (currentStatus === STATUS.CONNECTED) {
    setStatus(STATUS.ERROR, 'Connection lost');
  }
}

/**
 * ============================================
 * BRIDGE LOGIC - MESSAGE FLOW
 * ============================================
 */

async function handleFeishuToOpenCode(message) {
  try {
    const { chatId, text, userId, messageId, isMentioned } = message;

    if (logger) logger('info', `Feishu → OpenCode: ${text.substring(0, 100)}...`, { chatId, userId });

    if (!chatIdToSessionMap.has(chatId)) {
      try {
        const newSessionId = await opencode.createSession();
        chatIdToSessionMap.set(chatId, newSessionId);
        if (logger) logger('success', `Created OpenCode session ${newSessionId} for chat ${chatId}`);
      } catch (error) {
        if (logger) logger('error', 'Failed to create OpenCode session:', error.message);
        enqueue({
          direction: 'feishu→opencode',
          chatId,
          text,
          userId,
          messageId,
          retryCount: 0
        });
        return;
      }
    }

    const sessionIdForChat = chatIdToSessionMap.get(chatId);

    try {
      await opencode.sendMessage(sessionIdForChat, text);
      if (logger) logger('success', `Message sent to OpenCode session ${sessionIdForChat}`);
      
      emitEvent('message', {
        direction: 'feishu→opencode',
        chatId,
        text,
        sessionId: sessionIdForChat,
        timestamp: Date.now()
      });
    } catch (error) {
      if (logger) logger('error', 'Failed to send message to OpenCode:', error.message);
      enqueue({
        direction: 'feishu→opencode',
        chatId,
        text,
        userId,
        messageId,
        retryCount: 0
      });
    }

  } catch (error) {
    if (logger) logger('error', 'Error in handleFeishuToOpenCode:', error.message);
    emitEvent('error', { 
      source: 'handleFeishuToOpenCode', 
      error: error.message 
    });
  }
}

async function handleOpenCodeToFeishu(message) {
  try {
    let text = '';
    let sessionIdFromMsg = null;

    if (typeof message === 'string') {
      text = message;
    } else if (message && message.content) {
      text = message.content;
      sessionIdFromMsg = message.sessionId;
    } else if (message && message.text) {
      text = message.text;
    } else if (message && message.parts && Array.isArray(message.parts)) {
      // OpenCode returns message in parts array
      const textParts = message.parts
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text);
      text = textParts.join('');
    }

    if (!text) {
      if (logger) logger('warn', 'Empty message from OpenCode, skipping');
      return;
    }

    if (logger) logger('info', `OpenCode → Feishu: ${text.substring(0, 100)}...`);

    let targetChatId = null;
    for (const [chatId, sid] of chatIdToSessionMap.entries()) {
      if (sid === sessionIdFromMsg || sid === sessionId) {
        targetChatId = chatId;
        break;
      }
    }

    if (!targetChatId && chatIdToSessionMap.size > 0) {
      const entries = Array.from(chatIdToSessionMap.keys());
      targetChatId = entries[entries.length - 1];
    }

    if (!targetChatId) {
      if (logger) logger('error', 'No chat mapping found for OpenCode message');
      enqueue({
        direction: 'opencode→feishu',
        text,
        sessionId: sessionIdFromMsg,
        retryCount: 0
      });
      return;
    }

    try {
      await feishu.sendMessage(targetChatId, text);
      if (logger) logger('success', `Message sent to Feishu chat ${targetChatId}`);
      
      emitEvent('message', {
        direction: 'opencode→feishu',
        chatId: targetChatId,
        text,
        timestamp: Date.now()
      });
    } catch (error) {
      if (logger) logger('error', 'Failed to send message to Feishu:', error.message);
      enqueue({
        direction: 'opencode→feishu',
        chatId: targetChatId,
        text,
        retryCount: 0
      });
    }

  } catch (error) {
    if (logger) logger('error', 'Error in handleOpenCodeToFeishu:', error.message);
    emitEvent('error', { 
      source: 'handleOpenCodeToFeishu', 
      error: error.message 
    });
  }
}

async function processQueue() {
  if (currentStatus !== STATUS.CONNECTED) {
    return;
  }

  while (!isEmpty()) {
    const message = dequeue();
    if (!message) continue;

    try {
      if (message.direction === 'feishu→opencode') {
        const sessionIdForChat = chatIdToSessionMap.get(message.chatId);
        if (sessionIdForChat) {
          await opencode.sendMessage(sessionIdForChat, message.text);
          if (logger) logger('success', `Queued message sent to OpenCode: ${message.text.substring(0, 50)}...`);
        }
      } else if (message.direction === 'opencode→feishu') {
        await feishu.sendMessage(message.chatId, message.text);
        if (logger) logger('success', `Queued message sent to Feishu: ${message.text.substring(0, 50)}...`);
      }
    } catch (error) {
      if (logger) logger('error', 'Failed to process queued message:', error.message);
      if (message.retryCount < 3) {
        message.retryCount++;
        messageQueue.unshift(message);
      }
    }
  }
}

/**
 * ============================================
 * MAIN FUNCTIONS
 * ============================================
 */

async function start(config) {
  if (!config) {
    throw new Error('Config is required');
  }
  if (!config.opencode) {
    throw new Error('opencode config is required');
  }
  if (!config.feishu) {
    throw new Error('feishu config is required');
  }
  if (!config.feishu.appId || !config.feishu.appSecret) {
    throw new Error('feishu appId and appSecret are required');
  }

  if (currentStatus === STATUS.CONNECTED || currentStatus === STATUS.CONNECTING) {
    throw new Error('Bridge is already running');
  }

  setStatus(STATUS.CONNECTING);
  connectionStartTime = Date.now();
  
  // Set up logger if provided
  if (config.logger) {
    logger = config.logger;
  }
  
  if (logger) logger('info', 'Initializing bridge...');

  return new Promise(async (resolve, reject) => {
    try {
      feishu.on('message', handleFeishuToOpenCode);
      feishu.on('connected', () => {
        feishuConnected = true;
        if (logger) logger('success', 'Feishu connected');
        updateConnectionStatus();
      });
      feishu.on('disconnected', () => {
        feishuConnected = false;
        if (logger) logger('warn', 'Feishu disconnected');
        updateConnectionStatus();
      });
      feishu.on('error', (error) => {
        if (logger) logger('error', 'Feishu error:', error.message);
        emitEvent('error', { source: 'feishu', error });
      });

      opencode.on('message', handleOpenCodeToFeishu);
      opencode.on('connected', () => {
        opencodeConnected = true;
        if (logger) logger('success', 'OpenCode connected');
        updateConnectionStatus();
      });
      opencode.on('disconnected', () => {
        opencodeConnected = false;
        if (logger) logger('warn', 'OpenCode disconnected');
        updateConnectionStatus();
      });
      opencode.on('error', (error) => {
        if (logger) logger('error', 'OpenCode error:', error.message);
        emitEvent('error', { source: 'opencode', error });
      });

      if (logger) logger('info', 'Starting Feishu connection...');
      await feishu.start(config.feishu.appId, config.feishu.appSecret);
      feishuConnected = true;

      if (logger) logger('info', 'Starting OpenCode process...');
      await opencode.start(config.opencode);
      opencodeConnected = true;

      if (logger) logger('info', 'Starting OpenCode event stream...');
      await opencode.getEventStream();

      updateConnectionStatus();

      setInterval(processQueue, 5000);

      if (logger) logger('success', 'Bridge started successfully');
      resolve();

    } catch (error) {
      if (logger) logger('error', 'Failed to start bridge:', error.message);
      setStatus(STATUS.ERROR, error.message);
      
      try {
        await stop();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      reject(error);
    }
  });
}

async function stop() {
  if (logger) logger('info', 'Stopping bridge...');
  
  setStatus(STATUS.IDLE);
  
  clear();
  chatIdToSessionMap.clear();
  sessionId = null;
  
  const stopPromises = [];
  
  if (feishuConnected) {
    stopPromises.push(
      feishu.stop().catch(err => {
        if (logger) logger('error', 'Error stopping Feishu:', err.message);
      })
    );
    feishuConnected = false;
  }
  
  if (opencodeConnected) {
    stopPromises.push(
      opencode.stop().catch(err => {
        if (logger) logger('error', 'Error stopping OpenCode:', err.message);
      })
    );
    opencodeConnected = false;
  }
  
  eventEmitter.removeAllListeners();
  
  for (const event in eventHandlers) {
    eventHandlers[event] = [];
  }
  
  await Promise.all(stopPromises);
  
  if (logger) logger('info', 'Bridge stopped');
}

function getStatus() {
  return {
    status: currentStatus,
    error: errorMessage,
    feishuConnected,
    opencodeConnected,
    queueSize: size(),
    connectionStartTime,
    lastErrorTime,
    sessionCount: chatIdToSessionMap.size
  };
}

function on(event, handler) {
  if (!event || typeof handler !== 'function') {
    throw new Error('Event name and handler function are required');
  }

  const validEvents = ['message', 'statusChange', 'error'];
  if (!validEvents.includes(event)) {
    throw new Error(`Invalid event name. Must be one of: ${validEvents.join(', ')}`);
  }

  if (!eventHandlers[event]) {
    eventHandlers[event] = [];
  }
  eventHandlers[event].push(handler);
  eventEmitter.on(event, handler);

  return function unsubscribe() {
    off(event, handler);
  };
}

function off(event, handler) {
  if (!eventHandlers[event]) {
    return;
  }

  const index = eventHandlers[event].indexOf(handler);
  if (index > -1) {
    eventHandlers[event].splice(index, 1);
  }

  eventEmitter.removeListener(event, handler);
}

function emitEvent(event, data) {
  eventEmitter.emit(event, data);
}

module.exports = {
  start,
  stop,
  getStatus,
  on,
  off,
  queue: {
    enqueue,
    dequeue,
    isEmpty,
    size,
    clear
  },
  STATUS,
  MAX_QUEUE_SIZE
};
