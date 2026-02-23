import { WSClient, EventDispatcher } from '@larksuiteoapi/node-sdk';
import { EventEmitter } from 'events';

/**
 * Feishu WebSocket Long Connection Integration Module
 * 
 * Provides WebSocket connection to Feishu/Lark platform for
 * real-time message receiving and REST API for message sending.
 */

// State management
let wsClient = null;
let eventDispatcher = null;
let connected = false;
let appId = null;
let appSecret = null;

// Event handlers storage
const eventHandlers = {
  message: [],
  connected: [],
  disconnected: [],
  error: []
};

// EventEmitter for internal use
let eventEmitter = new EventEmitter();

// Allow external setting of event emitter (for bridge integration)
export function setEventEmitter(emitter) {
  eventEmitter = emitter;
}

/**
 * Start Feishu WebSocket connection
 * @param {string} feishuAppId - Feishu app ID
 * @param {string} feishuAppSecret - Feishu app secret
 * @returns {Promise<void>} Resolves when connected
 */
async function start(feishuAppId, feishuAppSecret) {
  if (connected) {
    throw new Error('Feishu connection already started');
  }

  if (!feishuAppId || !feishuAppSecret) {
    throw new Error('appId and appSecret are required');
  }

  appId = feishuAppId;
  appSecret = feishuAppSecret;

  try {
    // Create WSClient
    wsClient = new WSClient({
      appId: appId,
      appSecret: appSecret,
      loggerLevel: 'info'
    });

    // Create EventDispatcher
    eventDispatcher = new EventDispatcher({
      useUnifiedToken: true
    });
    
    console.log('[Feishu] EventDispatcher created');

    // Register 'im.message.receive_v1' event handler
    eventDispatcher.register({
      'im.message.receive_v1': async (data) => {
        console.log('[Feishu] ========== RECEIVED im.message.receive_v1 ==========');
        console.log('[Feishu] Raw data:', JSON.stringify(data, null, 2));
        // 飞书消息数据结构：直接在 data 中，没有 event 包装
        handleIncomingMessage(data);
      }
    });
    // Start the WebSocket client
    console.log('[Feishu] Starting WebSocket client...');
    await wsClient.start({ eventDispatcher });
    console.log('[Feishu] WebSocket client started successfully');

    // Mark as connected and emit event
    connected = true;
    console.log('[Feishu] Connection established, emitting connected event');
    emitEvent('connected');

    // Mark as connected and emit event
    connected = true;
    emitEvent('connected');

  } catch (error) {
    // Clean up on error
    if (wsClient) {
      try {
        wsClient.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      wsClient = null;
    }
    eventDispatcher = null;
    connected = false;
    throw error;
  }
}

/**
 * Handle incoming message from Feishu
 * @param {object} data - Message data from Feishu
 */
function handleIncomingMessage(data) {
  console.log('[Feishu DEBUG] handleIncomingMessage called');
  try {
    // 飞书数据结构是扁平的，没有 event 包装
    // 直接从 data 中获取字段
    const message = data.message;
    const chatId = message?.chat_id;
    const userId = data.sender?.sender_id?.open_id;
    const messageId = message?.message_id;

    console.log('[Feishu DEBUG] extracted:', { chatId, userId, messageId });

    if (!message || !chatId) {
      console.log('[Feishu DEBUG] Early return: no message or chatId');
      return;
    }
    // Check if message mentions the bot (@bot)
    const mentions = message.mentions || [];
    const isMentioned = mentions.length > 0;
    let text = '';
    if (message.content) {
      try {
        const content = JSON.parse(message.content);
        text = content.text || '';
      } catch (e) {
        // If not JSON, use content directly
        text = message.content;
      }
    }

    console.log('[Feishu DEBUG] About to emit message event:', { chatId, text: text.substring(0, 50) });
    // Only emit message if bot is mentioned (for @bot commands)
    // or allow all messages based on requirements
    emitEvent('message', {
      chatId,
      text,
      userId,
      messageId,
      isMentioned,
      raw: message
    });
  } catch (error) {
    emitEvent('error', { message: 'Error handling incoming message', error });
  }
}

/**
 * Stop Feishu WebSocket connection
 * @returns {Promise<void>}
 */
async function stop() {
  if (!connected || !wsClient) {
    connected = false;
    return;
  }

  try {
    // Close WSClient
    wsClient.close();
    connected = false;

    // Clean up
    wsClient = null;
    eventDispatcher = null;
    appId = null;
    appSecret = null;

    emitEvent('disconnected');
  } catch (error) {
    emitEvent('error', { message: 'Error stopping connection', error });
  }
}

/**
 * Send typing status to Feishu chat
 * @param {string} chatId - Chat ID to send typing status to
 * @returns {Promise<object>} Response from Feishu API
 */
async function sendTypingStatus(chatId) {
  if (!chatId) {
    throw new Error('chatId is required');
  }

  if (!appId || !appSecret) {
    throw new Error('Feishu connection not started. Call start() first.');
  }

  // 飞书正在输入状态 API
  const url = `https://open.feishu.cn/open-apis/im/v1/messages/typing`;

  const body = {
    chat_id: chatId,
    type: 'typing'
  };

  try {
    const { default: axios } = await import('axios');

    // Get tenant access token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      }
    );

    if (tokenResponse.data.code !== 0) {
      throw new Error(`Failed to get access token: ${tokenResponse.data.msg}`);
    }

    const accessToken = tokenResponse.data.tenant_access_token;

    console.log('[Feishu DEBUG] Sending typing status:', { chatId });
    
    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Feishu DEBUG] Typing status sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('[Feishu DEBUG] Send typing status failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      chatId
    });
    // 打字状态失败不应该阻塞主流程，只记录错误
    return null;
  }
}

/**
 * Send text message to Feishu chat via REST API
 * @param {string} chatId - Chat ID to send message to
 * @param {string} text - Text content to send
 * @returns {Promise<object>} Response from Feishu API
 */
async function sendMessage(chatId, text) {
  if (!chatId || !text) {
    throw new Error('chatId and text are required');
  }

  if (!appId || !appSecret) {
    throw new Error('Feishu connection not started. Call start() first.');
  }

  // receive_id_type must be in URL query params, not body
  const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`;

  const body = {
    receive_id: chatId,
    content: JSON.stringify({ text }),
    msg_type: 'text'
  };

  try {
    // Import axios for HTTP requests
    const { default: axios } = await import('axios');

    // Get tenant access token first
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      }
    );

    if (tokenResponse.data.code !== 0) {
      throw new Error(`Failed to get access token: ${tokenResponse.data.msg}`);
    }

    const accessToken = tokenResponse.data.tenant_access_token;

    // Send the message
    console.log('[Feishu DEBUG] Sending message:', { url, body, chatId, text: text.substring(0, 50) });
    
    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Feishu DEBUG] Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('[Feishu DEBUG] Send message failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      fieldViolations: error.response?.data?.error?.field_violations,
      chatId,
      text: text.substring(0, 50)
    });
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

/**
 * Register event listener
 * @param {string} event - Event name ('message', 'connected', 'disconnected', 'error')
 * @param {function} handler - Event handler function
 * @returns {function} Unsubscribe function
 */
function on(event, handler) {
  if (!event || typeof handler !== 'function') {
    throw new Error('Event name and handler function are required');
  }

  const validEvents = ['message', 'connected', 'disconnected', 'error'];
  if (!validEvents.includes(event)) {
    throw new Error(`Invalid event name. Must be one of: ${validEvents.join(', ')}`);
  }

  // Store the handler
  if (!eventHandlers[event]) {
    eventHandlers[event] = [];
  }
  eventHandlers[event].push(handler);

  // Also use EventEmitter for internal handling
  eventEmitter.on(event, handler);

  // Return unsubscribe function
  return function unsubscribe() {
    off(event, handler);
  };
}

/**
 * Remove event listener
 * @param {string} event - Event name
 * @param {function} handler - Event handler function
 */
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

/**
 * Emit event to all registered handlers
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
function emitEvent(event, data) {
  console.log(`[Feishu DEBUG] emitEvent called: ${event}`, data);
  eventEmitter.emit(event, data);
}

/**
 * Get connection status
 * @returns {boolean}
 */
function isConnected() {
  return connected;
}

// Export public API
export {
  start,
  stop,
  sendMessage,
  sendTypingStatus,
  on,
  off,
  isConnected
};

// Default export with all functions
export default {
  start,
  stop,
  sendMessage,
  sendTypingStatus,
  on,
  off,
  isConnected
};
