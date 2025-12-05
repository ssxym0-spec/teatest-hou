# 变更日志: MongoDB遗留代码清理
**日期**: 2025-01-27
**任务**: 清理 src/ 目录下所有遗留的 MongoDB 连接代码和模型文件

## 📂 文件变更
### 删除 (Deleted)
- `src/legacy_server.js`: 删除了整个遗留的 MongoDB 服务器文件（包含所有 MongoDB 路由和连接逻辑）
- `src/models/AdoptionPlan.js`: 删除了云养茶园领养方案 MongoDB 模型
- `src/models/DailyGrowthLog.js`: 删除了生长日志 MongoDB 模型
- `src/models/HarvestRecord.js`: 删除了采摘记录 MongoDB 模型
- `src/models/WeatherTemplate.js`: 删除了天气模板 MongoDB 模型
- `src/models/TeaCategory.js`: 删除了茶叶品类 MongoDB 模型
- `src/models/Plot.js`: 删除了地块 MongoDB 模型
- `src/models/Batch.js`: 删除了制作批次 MongoDB 模型
- `src/models/Grade.js`: 删除了等级管理 MongoDB 模型
- `src/models/Personnel.js`: 删除了人员管理 MongoDB 模型
- `src/models/AppreciationTemplate.js`: 删除了鉴赏模板 MongoDB 模型
- `src/models/TitleTemplate.js`: 删除了标题模板 MongoDB 模型
- `src/models/ProductionStepTemplate.js`: 删除了制作步骤模板 MongoDB 模型
- `src/models/MonthlySummary.js`: 删除了月度总结 MongoDB 模型
- `src/models/Setting.js`: 删除了设置 MongoDB 模型

### 修改 (Modified)
- `src/controllers/authController.ts`: 清理了关于 legacy_server.js 的遗留注释

## 💡 技术说明 (Technical Notes)
- **清理范围**: 仅清理 `src/` 目录下的主应用程序代码，保留 `scripts/migrate-data.ts` 中的 MongoDB 连接代码（迁移工具仍需要）
- **验证结果**: 通过全量搜索确认 `src/` 目录下已无任何 `mongoose`、`mongodb`、`MongoClient` 或 `db.collection` 相关代码
- **影响**: 主应用程序现在 100% 使用 Prisma 和 PostgreSQL，所有 MongoDB 依赖已从主代码库中移除
- **保留项**: `package.json` 中的 `mongodb` 和 `mongoose` 包保持不变，因为迁移脚本仍需要它们

