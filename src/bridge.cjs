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
const net = require('net');
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

// Message deduplication
const processedMessageIds = new Set();
const MAX_STORED_MESSAGE_IDS = 1000;
const MESSAGE_ID_RETENTION_MS = 5 * 60 * 1000; // 5 minutes

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

// Store handler references for proper cleanup
const handlerReferences = {
  feishu: {
    message: null,
    connected: null,
    disconnected: null,
    error: null
  },
  opencode: {
    message: null,
    connected: null,
    disconnected: null,
    error: null
  }
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

function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  
  processedMessageIds.add(messageId);
  
  if (processedMessageIds.size > MAX_STORED_MESSAGE_IDS) {
    const iterator = processedMessageIds.values();
    processedMessageIds.delete(iterator.next().value);
  }
  
  return false;
}

async function handleFeishuToOpenCode(message) {
  try {
    const { chatId, text, userId, messageId, isMentioned } = message;

    if (messageId && isDuplicateMessage(messageId)) {
      if (logger) logger('warn', `Duplicate message ${messageId} skipped`);
      return;
    }

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

// Track processed OpenCode message IDs to prevent duplicates
const processedOpenCodeMessageIds = new Set();
const MAX_STORED_OPENCODE_MESSAGE_IDS = 1000;

function isDuplicateOpenCodeMessage(message) {
  // Generate a unique key based on message content and timestamp
  let messageKey = null;
  
  if (typeof message === 'string') {
    messageKey = `str:${message}`;
  } else if (message && message.content) {
    messageKey = `content:${message.content}`;
  } else if (message && message.text) {
    messageKey = `text:${message.text}`;
  } else if (message && message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts
      .filter(part => part.type === 'text' && part.text)
      .map(part => part.text);
    messageKey = `parts:${textParts.join('')}`;
  }
  
  if (!messageKey) return false;
  
  if (processedOpenCodeMessageIds.has(messageKey)) {
    return true;
  }
  
  processedOpenCodeMessageIds.add(messageKey);
  
  // Limit the size of the Set
  if (processedOpenCodeMessageIds.size > MAX_STORED_OPENCODE_MESSAGE_IDS) {
    const iterator = processedOpenCodeMessageIds.values();
    processedOpenCodeMessageIds.delete(iterator.next().value);
  }
  
  return false;
}

async function handleOpenCodeToFeishu(message) {
  try {
    // Check for duplicate OpenCode messages
    if (isDuplicateOpenCodeMessage(message)) {
      if (logger) logger('warn', 'Duplicate OpenCode message skipped');
      return;
    }

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

// Helper function to check if a port is in use
function checkPortInUse(host, port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ host, port }, () => {
      tester.destroy();
      resolve(true); // Port is in use
    });
    tester.on('error', () => {
      resolve(false); // Port is free
    });
  });
}

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

  // Check if the opencode port is already in use
  const { host = 'localhost', port } = config.opencode;
  if (port) {
    const isPortInUse = await checkPortInUse(host, port);
    if (isPortInUse) {
      const errorMsg = `Port ${port} is already in use. There might be a previous opencode process running. Please stop it manually or use a different port.`;
      if (logger) logger('error', errorMsg);
      setStatus(STATUS.ERROR, errorMsg);
      throw new Error(errorMsg);
    }
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Store handler references for cleanup
      handlerReferences.feishu.message = handleFeishuToOpenCode;
      handlerReferences.feishu.connected = () => {
        feishuConnected = true;
        if (logger) logger('success', 'Feishu connected');
        updateConnectionStatus();
      };
      handlerReferences.feishu.disconnected = () => {
        feishuConnected = false;
        if (logger) logger('warn', 'Feishu disconnected');
        updateConnectionStatus();
      };
      handlerReferences.feishu.error = (error) => {
        if (logger) logger('error', 'Feishu error:', error.message);
        emitEvent('error', { source: 'feishu', error });
      };

      handlerReferences.opencode.message = handleOpenCodeToFeishu;
      handlerReferences.opencode.connected = () => {
        opencodeConnected = true;
        if (logger) logger('success', 'OpenCode connected');
        updateConnectionStatus();
      };
      handlerReferences.opencode.disconnected = () => {
        opencodeConnected = false;
        if (logger) logger('warn', 'OpenCode disconnected');
        updateConnectionStatus();
      };
      handlerReferences.opencode.error = (error) => {
        if (logger) logger('error', 'OpenCode error:', error.message);
        emitEvent('error', { source: 'opencode', error });
      };

      // Register handlers
      feishu.on('message', handlerReferences.feishu.message);
      feishu.on('connected', handlerReferences.feishu.connected);
      feishu.on('disconnected', handlerReferences.feishu.disconnected);
      feishu.on('error', handlerReferences.feishu.error);

      opencode.on('message', handlerReferences.opencode.message);
      opencode.on('connected', handlerReferences.opencode.connected);
      opencode.on('disconnected', handlerReferences.opencode.disconnected);
      opencode.on('error', handlerReferences.opencode.error);

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
  
  // Remove all registered event handlers from feishu and opencode
  if (handlerReferences.feishu.message) {
    feishu.off('message', handlerReferences.feishu.message);
    handlerReferences.feishu.message = null;
  }
  if (handlerReferences.feishu.connected) {
    feishu.off('connected', handlerReferences.feishu.connected);
    handlerReferences.feishu.connected = null;
  }
  if (handlerReferences.feishu.disconnected) {
    feishu.off('disconnected', handlerReferences.feishu.disconnected);
    handlerReferences.feishu.disconnected = null;
  }
  if (handlerReferences.feishu.error) {
    feishu.off('error', handlerReferences.feishu.error);
    handlerReferences.feishu.error = null;
  }

  if (handlerReferences.opencode.message) {
    opencode.off('message', handlerReferences.opencode.message);
    handlerReferences.opencode.message = null;
  }
  if (handlerReferences.opencode.connected) {
    opencode.off('connected', handlerReferences.opencode.connected);
    handlerReferences.opencode.connected = null;
  }
  if (handlerReferences.opencode.disconnected) {
    opencode.off('disconnected', handlerReferences.opencode.disconnected);
    handlerReferences.opencode.disconnected = null;
  }
  if (handlerReferences.opencode.error) {
    opencode.off('error', handlerReferences.opencode.error);
    handlerReferences.opencode.error = null;
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
