# 配置保存位置重构 - 实施计划

## 任务概述

将配置文件保存位置从 `项目根目录/.config.json` 改为 `{workDir}/.feishu-bridge/config.json`，让每个工作区拥有独立的配置。

## 详细实施步骤

---

### Task 1: 重构 config.js 核心模块

**文件**: `src/config.js`

**修改内容**:

1. **新增常量定义**
   ```javascript
   // 项目根目录（向后兼容）
   const PROJECT_ROOT = path.resolve(__dirname, '..');
   // 旧版配置文件路径（向后兼容）
   const LEGACY_CONFIG_PATH = path.join(PROJECT_ROOT, '.config.json');
   ```

2. **新增 `getConfigPath(workDir)` 函数**
   - 根据 workDir 计算配置路径
   - 如果 workDir 为空，返回 LEGACY_CONFIG_PATH（向后兼容）
   - 配置路径格式: `{workDir}/.feishu-bridge/config.json`

3. **新增 `ensureConfigDir(configPath)` 函数**
   - 确保配置文件的父目录存在
   - 使用 `fs.mkdirSync` 递归创建目录

4. **新增 `tryLoadConfigFromPath(configPath)` 函数**
   - 尝试从指定路径加载配置
   - 处理文件不存在、JSON 解析错误等异常情况
   - 返回配置对象或 null

5. **重构 `loadConfig(workDir)` 函数**
   - 优先从 workDir 加载配置
   - 如果 workDir 配置不存在，尝试加载旧版配置（向后兼容）
   - 添加日志输出，方便调试

6. **重构 `saveConfig(config, workDir)` 函数**
   - 始终保存到 workDir 下（如果提供了 workDir 或 config.workDir）
   - 自动创建必要的目录结构
   - 添加错误处理和日志输出

7. **新增 `migrateConfig(workDir)` 函数（可选）**
   - 将旧版配置迁移到新的位置
   - 迁移成功后备份旧配置

8. **更新 `validateConfig(config)` 函数**
   - 保持现有验证逻辑
   - 确保与新的配置结构兼容

**QA 测试点**:
- 配置文件是否正确保存到 workDir/.feishu-bridge/config.json
- 从 workDir 能否正确读取配置
- 向后兼容：旧配置能否正常读取
- 目录不存在时能否自动创建

---

### Task 2: 调整 index.js API 层

**文件**: `src/index.js`

**修改内容**:

1. **更新配置加载调用**
   ```javascript
   // GET /api/config - 调整以支持从 workDir 加载
   app.get('/api/config', (req, res) => {
     // 如果请求中提供了 workDir，使用它；否则尝试从已有配置加载
     const workDir = req.query.workDir;
     const config = loadConfig(workDir);
     res.json(config || bridgeConfig);
   });
   ```

2. **更新配置保存调用**
   ```javascript
   // POST /api/config - 保存到 workDir
   app.post('/api/config', async (req, res) => {
     try {
       const newConfig = req.body;
       
       // 确定 workDir
       const workDir = newConfig.workDir;
       if (!workDir) {
         return res.status(400).json({
           success: false,
           error: 'workDir is required'
         });
       }
       
       // 保存配置（saveConfig 会自动使用 workDir）
       const success = saveConfig(newConfig, workDir);
       // ... 其余逻辑不变
     }
   });
   ```

3. **更新桥接启动时的配置加载**
   ```javascript
   // 在 /api/start 中
   const config = loadConfig();
   // 如果 config 中没有 workDir，使用默认的
   const effectiveWorkDir = config?.workDir || './work';
   ```

**QA 测试点**:
- GET /api/config 是否正确返回配置
- POST /api/config 是否保存到正确的位置
- 启动桥接时是否正确加载配置

---

### Task 3: 测试验证

**测试场景**:

1. **新配置保存测试**
   - 设置 workDir 为 `/path/to/workspace`
   - 保存配置
   - 验证文件是否保存到 `/path/to/workspace/.feishu-bridge/config.json`

2. **配置读取测试**
   - 从上述路径加载配置
   - 验证配置内容正确

3. **向后兼容测试**
   - 在项目根目录放置旧配置
   - 尝试加载（不使用 workDir）
   - 验证能正确读取旧配置

4. **切换 workDir 测试**
   - 先保存配置到 workDir A
   - 再保存配置到 workDir B
   - 验证两个目录的配置互不影响

5. **边界情况测试**
   - workDir 为空字符串
   - workDir 是相对路径
   - workDir 不存在（自动创建）

---

### Task 4: 文档更新

**更新内容**:

1. **README.md**
   - 更新配置说明，说明配置保存在 workDir 下
   - 添加关于配置位置的说明
   - 更新快速开始指南

2. **README_EN.md**
   - 同步更新英文文档

---

## 实施顺序

1. ✅ 完成 Task 1（重构 config.js）
2. ⏳ 执行 Task 2（调整 index.js）
3. ⏳ 执行 Task 3（测试验证）
4. ⏳ 执行 Task 4（文档更新）

## 下一步行动

准备开始实施 Task 1，重构 `src/config.js` 文件。
