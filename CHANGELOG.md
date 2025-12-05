# 项目变更记录 (Project Changelog)

## [Unreleased] - 待发布

### 2025-01-XX - 认证系统修复与核心模块迁移

#### 🔐 Auth 模块修复
- 🐛 **Fix**: 修复 `views/login.html` - 将表单提交从传统 POST 改为使用 fetch API，解决 "Cannot POST /login" 错误
  - 移除了表单的 `action="/login"` 和 `method="POST"` 属性
  - 添加了 JavaScript 处理函数，使用 fetch 发送 POST 请求到 `/api/auth/login`
  - 实现了 JSON 数据提交和响应处理（成功重定向，失败显示 alert）
- ♻️ **Refactor**: 修改 `src/controllers/authController.ts` - 将登录函数从返回重定向改为返回 JSON 响应
  - 成功时返回 `{ success: true, message, data }`
  - 失败时返回相应的 HTTP 状态码和错误信息
  - 保持 session 写入逻辑不变

#### 🛣️ 路由系统增强
- ✨ **Feat**: 修改 `src/server.ts` - 添加通用页面路由处理逻辑
  - 添加 `/dashboard` 路由映射到 `dashboard.html`
  - 添加 `/admin` 路由映射到 `dashboard.html`
  - 添加 `/admin/:page` 动态路由，自动查找 `views/{page}.html` 文件
  - 使用 `fs.existsSync` 检查文件存在性，不存在返回 404
  - 解决了 "Cannot GET /admin/landing-management" 等错误

#### 🌾 采摘记录模块迁移
- ✨ **Feat**: 创建 `src/controllers/harvestController.ts` - 实现采摘记录的完整 CRUD 操作
  - `createHarvestRecord`: 创建采摘记录，自动归类到品类，关联采摘队长
  - `getAllHarvestRecords`: 获取所有采摘记录，支持按月份筛选
  - `getUnassignedHarvestRecords`: 获取未归属的采摘记录
  - `getHarvestRecordById`: 获取单个采摘记录详情
  - `updateHarvestRecord`: 更新采摘记录，支持重新归类
  - `deleteHarvestRecord`: 删除采摘记录，自动解除批次关联
  - `syncHarvestRecordsWeather`: 批量同步天气数据（从生长日志同步）
- ✨ **Feat**: 创建 `src/routes/harvestRoutes.ts` - 定义采摘记录相关的路由
  - `POST /api/harvest-records` - 创建采摘记录
  - `GET /api/harvest-records` - 获取所有采摘记录（支持 `?month=YYYY-MM` 查询）
  - `GET /api/harvest-records/unassigned` - 获取未归属的采摘记录
  - `GET /api/harvest-records/:id` - 获取单个采摘记录
  - `PUT /api/harvest-records/:id` - 更新采摘记录
  - `DELETE /api/harvest-records/:id` - 删除采摘记录
  - `POST /api/harvest-records/sync-weather` - 批量同步天气数据
  - 所有路由都添加了 `requireLogin` 认证中间件
- 🔌 **Config**: 在 `src/server.ts` 中注册 `/api/harvest-records` 路由

#### 📦 批次管理模块迁移
- ✨ **Feat**: 创建 `src/controllers/traceabilityController.ts` - 实现批次管理的完整 CRUD 操作
  - `createBatch`: 创建制作批次，处理制茶师和等级关联，初始化默认生产步骤，关联采摘记录
  - `getAllBatches`: 获取所有制作批次（最近200条）
  - `getBatchById`: 获取单个批次详情（包含关联的采摘记录）
  - `updateBatch`: 更新批次基础信息
  - `updateBatchProductionSteps`: 更新制作步骤数组
  - `updateBatchStepCraft`: 精细化更新步骤的工艺类型（manual/modern）
  - `deleteBatch`: 删除批次，自动解除所有关联（使用事务保证一致性）
  - 使用 Prisma 事务确保批次与采摘记录关联的原子性操作
  - 使用 `BatchHarvestRecord` 联结表处理多对多关系
- ✨ **Feat**: 创建 `src/routes/traceabilityRoutes.ts` - 定义批次管理相关的路由
  - `POST /api/batches` - 创建制作批次
  - `GET /api/batches` - 获取所有制作批次
  - `GET /api/batches/:id` - 获取单个批次详情
  - `PUT /api/batches/:id` - 更新批次基础信息
  - `PUT /api/batches/:id/production-steps` - 更新制作步骤
  - `PUT /api/batches/:batchId/steps/:stepIndex/:craftType` - 精细化更新步骤工艺
  - `DELETE /api/batches/:id` - 删除批次
  - 所有路由都添加了 `requireLogin` 认证中间件
- 🔌 **Config**: 在 `src/server.ts` 中注册 `/api/batches` 路由

#### 🔧 技术实现细节
- 使用 Prisma Client 替代 Mongoose，实现从 MongoDB 到 PostgreSQL 的迁移
- 正确处理 Prisma 关联关系（Relations），使用 `connect` 语法处理外键关联
- 使用 `BatchHarvestRecord` 联结表实现批次与采摘记录的多对多关系
- 实现自动归类功能：采摘记录根据日期自动归类到对应品类
- 使用 Prisma 事务（`$transaction`）确保批次创建/删除时的数据一致性
- 实现关联查找：根据名称查找制茶师、等级、采摘队长并设置外键

#### 🐛 Bug 修复
- 修复了 "Cannot POST /login" 错误 - 通过将表单提交改为 fetch API 调用
- 修复了 "Cannot GET /admin/xxx" 错误 - 通过添加动态页面路由处理
- 修复了 "Unexpected token <" 错误 - 通过实现采摘和批次相关的 API 接口

---