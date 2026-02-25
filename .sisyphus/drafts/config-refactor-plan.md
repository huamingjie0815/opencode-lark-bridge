# 配置保存位置重构计划

## 目标
将配置文件保存位置从 `项目根目录/.config.json` 改为 `{workDir}/.feishu-bridge/config.json`

## 需求理解

### 当前行为
- 配置文件固定保存在项目根目录 `.config.json`
- 多个工作区共用同一个配置

### 期望行为
- 配置文件保存到用户设置的 `workDir` 下
- 每个工作区有独立的配置
- 支持向后兼容（旧配置可迁移）

## 实现方案

### 1. 修改 `src/config.js`

#### 新增功能
- `getConfigPath(workDir)` - 根据 workDir 计算配置路径
- 支持从 workDir 和项目根目录加载配置（向后兼容）
- 保存时始终保存到 workDir

#### 关键逻辑
```javascript
// 配置路径计算
function getConfigPath(workDir) {
  if (workDir) {
    return path.join(workDir, '.feishu-bridge', 'config.json');
  }
  return path.join(process.cwd(), '.config.json');
}

// 加载配置（优先 workDir，兼容旧配置）
function loadConfig(workDir) {
  // 1. 尝试从 workDir 加载
  // 2. 如果不存在，尝试从项目根目录加载（向后兼容）
  // 3. 返回默认配置
}
```

### 2. 修改 `src/index.js`

#### 调整点
- 加载配置时传入 workDir
- 保存配置时确保使用正确的路径
- API 端点调整以支持新的配置逻辑

### 3. 配置迁移（可选）

如果项目根目录有旧配置，且 workDir 没有配置，可以自动迁移：
```javascript
// 迁移逻辑
if (旧配置存在 && workDir配置不存在) {
  复制旧配置到 workDir;
}
```

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/config.js` | 重构 | 核心配置逻辑修改 |
| `src/index.js` | 调整 | API 端点和调用方式调整 |
| `README.md` | 更新 | 文档说明更新 |
| `README_EN.md` | 更新 | 英文文档更新 |

## 验收标准

- [x] 配置文件保存到 `{workDir}/.feishu-bridge/config.json`
- [x] 从 workDir 能正确读取配置
- [x] 切换 workDir 后使用新目录的配置
- [x] 向后兼容：旧配置可继续读取
- [x] 自动创建必要的目录结构
- [ ] 测试通过
- [ ] 文档更新

## 风险提示

1. **向后兼容性**: 旧版本配置在项目根目录，新版本需要兼容读取
2. **路径问题**: 相对路径和绝对路径的处理需要小心
3. **权限问题**: 确保有权限在 workDir 创建目录和文件
4. **并发问题**: 如果多个实例同时写入同一配置，可能产生冲突

## 下一步

1. ✅ 确认需求理解
2. ⏳ 开始实施修改
3. ⏳ 测试验证
4. ⏳ 文档更新
