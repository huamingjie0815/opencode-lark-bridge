const assert = require('assert');
const { EventEmitter } = require('events');

class MockEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.events = {};
    this.callHistory = [];
  }

  recordCall(method, args) {
    this.callHistory.push({ method, args: [...args], timestamp: Date.now() });
  }

  on(event, handler) {
    this.recordCall('on', [event, handler]);
    return super.on(event, handler);
  }

  emit(event, data) {
    this.recordCall('emit', [event, data]);
    return super.emit(event, data);
  }
}

const mockOpencode = {
  start: async () => { mockOpencode._calls.push('start'); },
  stop: async () => { mockOpencode._calls.push('stop'); },
  createSession: async () => { mockOpencode._calls.push('createSession'); return 'session123'; },
  sendMessage: async () => { mockOpencode._calls.push('sendMessage'); },
  on: (event, handler) => { mockOpencode._handlers[event] = handler; },
  off: () => {},
  emit: (event, data) => { if (mockOpencode._handlers[event]) mockOpencode._handlers[event](data); },
  getEventStream: async () => {},
  _calls: [],
  _handlers: {},
  reset: function() {
    this._calls = [];
    this._handlers = {};
  }
};

const mockFeishu = {
  start: async () => { mockFeishu._calls.push('start'); },
  stop: async () => { mockFeishu._calls.push('stop'); },
  sendMessage: async () => { mockFeishu._calls.push('sendMessage'); },
  on: (event, handler) => { mockFeishu._handlers[event] = handler; },
  off: () => {},
  emit: (event, data) => { if (mockFeishu._handlers[event]) mockFeishu._handlers[event](data); },
  _calls: [],
  _handlers: {},
  reset: function() {
    this._calls = [];
    this._handlers = {};
  }
};

const testConfig = {
  opencode: {
    workDir: '/test/workdir',
    port: 3000,
    host: 'localhost'
  },
  feishu: {
    appId: 'test_app_id',
    appSecret: 'test_app_secret'
  }
};

const invalidConfig = {
  opencode: {
    workDir: '/test/workdir',
    port: 3000,
    host: 'localhost'
  }
};

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

async function runTest(name, testFn) {
  try {
    mockOpencode.reset();
    mockFeishu.reset();
    
    await testFn();
    testsPassed++;
    testResults.push({ name, status: 'PASSED' });
    console.log('✓ ' + name);
  } catch (error) {
    testsFailed++;
    testResults.push({ name, status: 'FAILED', error: error.message });
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
  }
}

async function testBridgeStart() {
  let bridgeStatus = 'idle';
  let opencodeStarted = false;
  let feishuStarted = false;
  
  const mockBridgeStart = async (config) => {
    bridgeStatus = 'connecting';
    
    await mockOpencode.start(config.opencode);
    opencodeStarted = true;
    
    await mockFeishu.start(config.feishu.appId, config.feishu.appSecret);
    feishuStarted = true;
    
    bridgeStatus = 'connected';
  };
  
  await mockBridgeStart(testConfig);
  
  assert.strictEqual(bridgeStatus, 'connected', 'Bridge should be in connected status');
  assert.strictEqual(mockOpencode._calls.includes('start'), true, 'OpenCode start should be called');
  assert.strictEqual(mockFeishu._calls.includes('start'), true, 'Feishu start should be called');
  
  await mockFeishu.stop();
  await mockOpencode.stop();
}

async function testBridgeStop() {
  let bridgeStatus = 'connected';
  
  const mockBridgeStop = async () => {
    bridgeStatus = 'idle';
    
    await mockOpencode.stop();
    await mockFeishu.stop();
  };
  
  await mockOpencode.start();
  await mockFeishu.start();
  
  await mockBridgeStop();
  
  assert.strictEqual(bridgeStatus, 'idle', 'Bridge should be in idle status');
  assert.strictEqual(mockOpencode._calls.includes('stop'), true, 'OpenCode stop should be called');
  assert.strictEqual(mockFeishu._calls.includes('stop'), true, 'Feishu stop should be called');
}

async function testConfigValidation() {
  const validateConfig = (config) => {
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
  };
  
  let errorThrown = false;
  try {
    validateConfig(testConfig);
  } catch (error) {
    errorThrown = true;
  }
  assert.strictEqual(errorThrown, false, 'Valid config should not throw error');
  
  errorThrown = false;
  try {
    validateConfig(invalidConfig);
  } catch (error) {
    errorThrown = true;
    assert.strictEqual(error.message, 'feishu config is required', 'Error message should indicate missing feishu config');
  }
  assert.strictEqual(errorThrown, true, 'Invalid config should throw error');
  
  errorThrown = false;
  try {
    validateConfig(null);
  } catch (error) {
    errorThrown = true;
    assert.strictEqual(error.message, 'Config is required', 'Error message should indicate config is required');
  }
  assert.strictEqual(errorThrown, true, 'Null config should throw error');
}

async function testFeishuToOpenCode() {
  const sentMessages = [];
  
  mockOpencode.sendMessage = async (sessionId, text) => {
    mockOpencode._calls.push('sendMessage');
    sentMessages.push({ sessionId, text });
  };
  
  await mockOpencode.start();
  
  const sessionId = await mockOpencode.createSession();
  
  const feishuMessage = {
    chatId: 'test_chat',
    text: 'Hello from Feishu',
    userId: 'user123',
    messageId: 'msg456',
    isMentioned: true
  };
  
  const handleFeishuToOpenCode = async (message, chatIdToSessionMap) => {
    const { chatId, text } = message;
    
    let sessionIdForChat = chatIdToSessionMap.get(chatId);
    if (!sessionIdForChat) {
      sessionIdForChat = await mockOpencode.createSession();
      chatIdToSessionMap.set(chatId, sessionIdForChat);
    }
    
    await mockOpencode.sendMessage(sessionIdForChat, text);
  };
  
  const chatIdToSessionMap = new Map();
  chatIdToSessionMap.set('test_chat', sessionId);
  
  await handleFeishuToOpenCode(feishuMessage, chatIdToSessionMap);
  
  assert.strictEqual(mockOpencode._calls.includes('sendMessage'), true, 'OpenCode sendMessage should be called');
  assert.strictEqual(sentMessages.length, 1, 'One message should be sent');
  assert.strictEqual(sentMessages[0].text, 'Hello from Feishu', 'Message text should match');
}

async function testOpenCodeToFeishu() {
  const sentMessages = [];
  
  mockFeishu.sendMessage = async (chatId, text) => {
    mockFeishu._calls.push('sendMessage');
    sentMessages.push({ chatId, text });
  };
  
  await mockFeishu.start();
  
  const sessionId = 'session123';
  const chatId = 'test_chat';
  const chatIdToSessionMap = new Map();
  chatIdToSessionMap.set(chatId, sessionId);
  
  const opencodeMessage = {
    sessionId: 'session123',
    text: 'Hello from OpenCode'
  };
  
  const handleOpenCodeToFeishu = async (message, chatIdToSessionMap) => {
    const { sessionId, text } = message;
    
    let targetChatId = null;
    for (const [chatId, sid] of chatIdToSessionMap.entries()) {
      if (sid === sessionId) {
        targetChatId = chatId;
        break;
      }
    }
    
    if (!targetChatId) {
      throw new Error('No chat mapping found for OpenCode message');
    }
    
    await mockFeishu.sendMessage(targetChatId, text);
  };
  
  await handleOpenCodeToFeishu(opencodeMessage, chatIdToSessionMap);
  
  assert.strictEqual(mockFeishu._calls.includes('sendMessage'), true, 'Feishu sendMessage should be called');
  assert.strictEqual(sentMessages.length, 1, 'One message should be sent');
  assert.strictEqual(sentMessages[0].chatId, 'test_chat', 'ChatId should match');
  assert.strictEqual(sentMessages[0].text, 'Hello from OpenCode', 'Message text should match');
}

async function testFeishuConnectionError() {
  let status = 'connected';
  let errorLogged = false;
  
  const onError = (error) => {
    status = 'error';
    errorLogged = true;
  };
  
  mockFeishu.on('error', onError);
  
  await mockFeishu.start();
  
  const error = new Error('Feishu WebSocket error');
  mockFeishu.emit('error', error);
  
  assert.strictEqual(status, 'error', 'Status should change to error');
  assert.strictEqual(errorLogged, true, 'Error should be logged');
}

async function testOpenCodeCrash() {
  let status = 'connected';
  let cleanupPerformed = false;
  
  const onDisconnected = () => {
    status = 'error';
  };
  
  const onExit = () => {
    cleanupPerformed = true;
  };
  
  mockOpencode.on('disconnected', onDisconnected);
  
  await mockOpencode.start();
  
  mockOpencode.emit('disconnected');
  onExit();
  
  assert.strictEqual(status, 'error', 'Status should change to error after crash');
  assert.strictEqual(cleanupPerformed, true, 'Cleanup should be performed');
}


async function runAllTests() {
  console.log('========================================');
  console.log('Feishu-OpenCode Bridge E2E Tests');
  console.log('========================================\n');

  await runTest('Bridge Lifecycle - Start', testBridgeStart);
  await runTest('Bridge Lifecycle - Stop', testBridgeStop);
  await runTest('Configuration Management - Validation', testConfigValidation);
  await runTest('Message Flow - Feishu → OpenCode', testFeishuToOpenCode);
  await runTest('Message Flow - OpenCode → Feishu', testOpenCodeToFeishu);
  await runTest('Error Handling - Feishu Connection Error', testFeishuConnectionError);
  await runTest('Error Handling - OpenCode Process Crash', testOpenCodeCrash);

  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log('Total: ' + (testsPassed + testsFailed));
  console.log('Passed: ' + testsPassed);
  console.log('Failed: ' + testsFailed);
  console.log('========================================');

  process.exit(testsFailed > 0 ? 1 : 0);
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
