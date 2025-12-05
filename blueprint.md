## 系统重构蓝图（System Refactor Blueprint）

> 目标：将现有的 Node.js + Express + MongoDB (Mongoose) 后端迁移至 PostgreSQL + Prisma，并保持 API 契约与业务行为完全一致。本蓝图基于 `server.js`、`models/*.js` 以及所有交付文档（如 `BACKEND_SPEC.md`、`BACKEND_REFACTOR_SPEC.md` 等）整理，可作为后续 schema 设计与接口实现的唯一依据。

---

### 1. 核心业务逻辑摘要

- **认证与后台访问**
  - 单一管理员体系，使用 `express-session` + `bcrypt`。登录后可访问 `/admin` 下所有 HTML 管理页面，并通过 AJAX 调用 `/api/**`。
  - 提供密码修改、忘记密码/重置流程（token 存数据库，邮件链接目前打印在控制台）。

- **内容与配置管理**
  - **地块（Plots）**：维护轮播图、核心信息等，用于落地页展示。
  - **全局设置（Settings）**：CTA 背景、Footer 信息等键值化配置。
  - **天气模板 / 图标**：上传 SVG，维护天气标签供日志及公共页面使用。

- **茶园经营主线**
  1. **茶叶品类（Tea Categories）**
     - 管理采摘期、排序、描述。
     - 变更采摘期会触发采摘记录的自动归类。
  2. **每日生长日志（Daily Growth Logs）**
     - 记录当天环境、农事活动、图文素材。可关联记录人、地块。
     - 提供现有日期占用检查、防重复保存。
  3. **采摘记录（Harvest Records）**
     - 记录采摘日期、重量、采摘团队、媒体素材。
     - 自动依据日期映射所属品类；可手动“强制刷新归属”。
     - 支持批量同步天气（根据生长日志）。
  4. **制作批次（Batches）**
     - 聚合多条采摘记录形成生产批次，包含生产流程、品鉴报告、分级等信息。
     - 批次删除需解除采摘记录绑定。
     - 附带模板中心（步骤模板、批次标题模板、鉴赏模板）。
  5. **月度总结 / 汇总（Monthly Summaries）**
     - 汇总当月日志及采摘数据，可自动生成。

- **云养茶园方案（Adoption Plans）**
  - 三种方案：`private / enterprise / b2b`。
  - 私人定制包含套餐、动态套餐比对（列可增删、重命名）、场景化应用等。
  - 企业 / B2B 拥有各自专属字段。缺失数据时接口会创建默认占位。

- **公共体验**
  - `/api/public/**` 系列提供落地页、公开批次、天气模板、月度数据等访客可见内容。
  - 仅 `status=已发布` 的批次可对外展示。

---

### 2. SQL 数据库设计（核心）

> 统一使用 `UUID` 作为主键（Prisma: `String @id @default(uuid())`），时间字段为 `TIMESTAMPTZ`，并保留 `created_at`、`updated_at`。除特别说明外，所有 JSON 结构使用 PostgreSQL `JSONB`。

#### 2.1 账户与安全

| 表名 | 字段（类型） | 约束 / 关系 |
| --- | --- | --- |
| `users` | `id` UUID PK<br>`username` VARCHAR(100) UNIQUE NOT NULL<br>`password_hash` VARCHAR(255) NOT NULL<br>`reset_password_token` VARCHAR(128)<br>`reset_password_expires` TIMESTAMPTZ<br>`created_at` TIMESTAMPTZ DEFAULT now() | 仅供认证使用，与其他表无外键。 |

#### 2.2 基础资料

| 表名 | 字段 | 约束/关系 |
| --- | --- | --- |
| `plots` | `id` UUID PK<br>`name` VARCHAR(100) UNIQUE NOT NULL<br>`carousel_images` JSONB DEFAULT '[]'<br>`info_list` JSONB DEFAULT '[]'<br>`created_at` / `updated_at` | 供落地页和日志引用。 |
| `settings` | `id` UUID PK<br>`key` VARCHAR(100) UNIQUE NOT NULL<br>`value` TEXT<br>`description` VARCHAR(200)<br>`category` ENUM(`general`,`ui`,`content`,`media`,`contact`,`seo`,`social`,`footer`)<br>`data_type` ENUM(`string`,`number`,`boolean`,`url`,`email`,`json`,`text`)<br>`is_public` BOOLEAN DEFAULT false<br>`created_at` / `updated_at` | 键值化配置。 |
| `weather_templates` | `id` UUID PK<br>`name` VARCHAR(50) UNIQUE NOT NULL<br>`svg_icon` TEXT NOT NULL<br>`temperature_range` VARCHAR(50)<br>`description` VARCHAR(200)<br>`sort_order` INT DEFAULT 0<br>`is_active` BOOLEAN DEFAULT true<br>`created_at` / `updated_at` | 供日志/批次使用。 |

#### 2.3 品类、人员、等级

| 表名 | 字段 | 约束/关系 |
| --- | --- | --- |
| `tea_categories` | `id` UUID PK<br>`name` VARCHAR(50) UNIQUE NOT NULL<br>`slug` VARCHAR(100) UNIQUE NOT NULL<br>`image_url` TEXT<br>`description` TEXT<br>`yield_percentage` NUMERIC(5,2) DEFAULT 0<br>`picking_period` VARCHAR(100)<br>`picking_start_date` DATE<br>`picking_end_date` DATE<br>`sort_order` INT DEFAULT 999<br>`created_at` / `updated_at` | `harvest_records.category_id` FK → `tea_categories.id`。删除策略：`ON DELETE SET NULL`。 |
| `personnel` | `id` UUID PK<br>`name` VARCHAR(50) NOT NULL<br>`avatar_url` TEXT<br>`role` ENUM(`记录人`,`采摘队长`,`制茶师`) NOT NULL<br>`experience_years` INT DEFAULT 0<br>`created_at` / `updated_at` | 被 `daily_growth_logs.recorder_id`、`harvest_records.harvest_team_id`、`batches.tea_master_id` 引用。 |
| `grades` | `id` UUID PK<br>`name` VARCHAR(50) UNIQUE NOT NULL<br>`badge_url` TEXT<br>`created_at` / `updated_at` | `batches.grade_id` FK。 |

#### 2.4 日志与统计

| 表名 | 字段 | 关系 |
| --- | --- | --- |
| `daily_growth_logs` | `id` UUID PK<br>`date` DATE UNIQUE NOT NULL<br>`plot_id` UUID FK → `plots.id` NULLABLE<br>`recorder_name` VARCHAR(100)<br>`recorder_id` UUID FK → `personnel.id` NULLABLE<br>`main_image_url` TEXT<br>`status_tag` JSONB<br>`weather` JSONB<br>`summary` TEXT<br>`detail_gallery` JSONB<br>`photo_info` JSONB<br>`environment_data` JSONB<br>`full_log` TEXT<br>`farm_activity_type` ENUM(`无`,`施肥`,`修剪`,`灌溉`,`采摘`,`异常`)<br>`farm_activity_log` TEXT<br>`phenological_observation` TEXT<br>`abnormal_event` JSONB<br>`harvest_weight_kg` NUMERIC(10,2) DEFAULT 0<br>`created_at` / `updated_at` | `harvest_records` 可按日期查询天气信息；删除地块/人员时需 `SET NULL`。 |
| `monthly_summaries` | `id` UUID PK<br>`year_month` CHAR(7) UNIQUE NOT NULL<br>`plot_id` UUID FK → `plots.id` NULLABLE<br>`detail_gallery` JSONB<br>`harvest_stats` JSONB<br>`farm_calendar` TEXT<br>`abnormal_summary` JSONB<br>`climate_summary` JSONB<br>`next_month_plan` JSONB<br>`created_at` / `updated_at` | 由自动生成接口维护；无强制外键级联。 |

#### 2.5 采摘与生产主线

| 表名 | 字段 | 关系 / 说明 |
| --- | --- | --- |
| `harvest_records` | `id` UUID PK<br>`harvest_date` DATE NOT NULL<br>`fresh_leaf_weight_kg` NUMERIC(10,2) NOT NULL<br>`weather` JSONB<br>`images_and_videos` JSONB<br>`media_urls` JSONB<br>`harvest_team` JSONB `{leader_name,member_count ≥1,notes}`<br>`harvest_team_id` UUID FK → `personnel.id` (采摘队长) NULLABLE<br>`assigned_batch_id` UUID FK → `batches.id` NULLABLE (`ON DELETE SET NULL`)<br>`category_id` UUID FK → `tea_categories.id` NULLABLE<br>`category_name` VARCHAR(50)<br>`notes` TEXT<br>`created_at` / `updated_at` | 归属批次使用 `assigned_batch_id` + 联结表，自动分类依赖 `tea_categories` 的采摘期。 |
| `batches` | `id` UUID PK<br>`batch_number` VARCHAR(50) UNIQUE NOT NULL<br>`category_name` VARCHAR(50) NOT NULL<br>`tea_master` JSONB<br>`tea_master_id` UUID FK → `personnel.id` (制茶师) NULLABLE<br>`production_steps` JSONB<br>`tasting_report` JSONB<br>`product_appreciation` JSONB<br>`final_product_weight_kg` NUMERIC(10,2)<br>`grade` VARCHAR(50)<br>`grade_id` UUID FK → `grades.id` NULLABLE<br>`production_date` DATE DEFAULT CURRENT_DATE<br>`status` ENUM(`进行中`,`已完成`,`已发布`) NOT NULL<br>`cover_image_url` TEXT<br>`detail_cover_image_url` TEXT<br>`images_and_videos` JSONB<br>`notes` TEXT<br>`detail_title` TEXT<br>`created_at` / `updated_at` | 删除批次需解除采摘记录关联和联结表记录。 |
| `batch_harvest_records` | `batch_id` UUID FK → `batches.id`<br>`harvest_record_id` UUID FK → `harvest_records.id`<br>`linked_at` TIMESTAMPTZ DEFAULT now()<br>`notes` TEXT | 复合主键 `PK(batch_id, harvest_record_id)`；用于多对多绑定。应用层同时维护 `harvest_records.assigned_batch_id`。 |

#### 2.6 模板中心

| 表名 | 字段 | 说明 |
| --- | --- | --- |
| `production_step_templates` | `id` UUID PK<br>`step_name` VARCHAR(20) UNIQUE NOT NULL<br>`manual_craft` JSONB<br>`modern_craft` JSONB<br>`created_at` / `updated_at` | 仅少量固定记录。 |
| `title_templates` | `id` UUID PK<br>`category_name` VARCHAR(50) UNIQUE NOT NULL<br>`title_template` VARCHAR(200) NOT NULL<br>`created_at` / `updated_at` | |
| `appreciation_templates` | `id` UUID PK<br>`category_name` VARCHAR(50) UNIQUE NOT NULL<br>`tasting_notes` TEXT<br>`brewing_suggestion` TEXT<br>`storage_method` TEXT<br>`created_at` / `updated_at` | |

#### 2.7 云养茶园方案

| 表名 | 字段 | 说明 |
| --- | --- | --- |
| `adoption_plans` | `id` UUID PK<br>`type` ENUM(`private`,`enterprise`,`b2b`) UNIQUE NOT NULL<br>`marketing_header` JSONB<br>`value_propositions` JSONB<br>`customer_cases` JSONB<br>`scenario_applications` JSONB<br>`packages` JSONB<br>`comparison_package_names` JSONB (string[])<br>`comparison_features` JSONB（`{icon,feature_name,values[]}`）<br>`process_steps` JSONB<br>`use_scenarios` JSONB<br>`service_contents` JSONB<br>`description` TEXT<br>`created_at` / `updated_at` | JSON 字段保留原结构；`comparison_*` 支持动态套餐列。 |

---

### 3. API 接口规范

> 所有 `/api/**` 默认需要登录，除显式列出的公共路由。响应通用结构 `{ success: boolean, data?: any, message?: string }`，出错时返回相应 HTTP 状态码与 `message`。

#### 3.1 认证与账户

| Method & Path | 鉴权 | Request | Response / 备注 |
| --- | --- | --- | --- |
| `POST /login` | 无 | form `username`, `password` | 成功→302 `/dashboard`，失败携带 `error` query。 |
| `POST /logout` | Session | - | 销毁 session，302 登录页。 |
| `GET /api/user` | Session | - | `{success,true,user:{id,username}}`，取自会话。 |
| `POST /change-password` | Session | `oldPassword,newPassword,confirmPassword` | 成功后踢出会话。 |
| `POST /forgot-password` | 无 | `username` | 生成 1h token，控制台输出 URL。 |
| `POST /reset/:token` | 无 | `newPassword,confirmPassword` | 验证 token → 更新密码。 |

#### 3.2 文件上传

| Endpoint | 鉴权 | Request | Response |
| --- | --- | --- | --- |
| `POST /api/upload` | Session | FormData: `media`(file max 50MB), `category` | `{success,url,filename,originalName,size,mimetype,category}` |
| `POST /api/upload-image` | Session | FormData: `image` | `{success,data:{url,filename,fullUrl,size,...}}` |
| `POST /api/weather-templates/upload-icon` | Session | FormData: `svg_file` | `{success,data:{url,filename,original_name}}`，仅允许 SVG。 |

#### 3.3 地块 / 设置

- `GET /api/plots` → 全量列表。
- `POST /api/plots` → 创建，Body `{name,carousel_images?,info_list?}`。
- `POST /api/plots/:id/images` / `DELETE ...` / `PUT .../info` / `PUT .../carousel` → 维护数组字段。
- `DELETE /api/plots/:id` → 删除（需处理引用）。
- `GET /api/settings` / `GET /api/settings/footer` / `POST /api/settings/footer` / `GET|POST /api/settings/cta-background` → 键值对读写。

#### 3.4 品类管理

- `GET /api/categories`：返回 `{success,data:[...],count}`，禁用缓存。
- `POST /api/categories`：Body 与表字段一致，允许仅传 `picking_period`，后台解析起止日期。
- `PUT /api/categories/:id`：同创建，自动重算采摘期。
- `DELETE /api/categories/:id`：删除（建议先检查采摘记录）。
- `POST /api/categories/reclassify-harvest-records`：触发自动归类，响应 `{success,count}`。

#### 3.5 每日生长日志 / 月度总结

- `GET /api/growth-logs/existing-dates` → `["YYYY-MM-DD", ...]`
- `GET /api/growth-logs?month=YYYY-MM` → 按月筛选，内部调用 `enrichLogsWithHarvestInfo` 注入采摘统计。
- `GET /api/growth-logs/by-date?date=` → 提供天气给采摘记录。
- `GET /api/growth-logs/:id`、`POST /api/growth-logs`、`PUT ...`、`DELETE ...` → 完整 CRUD。
- `GET /api/monthly-summaries?month=`、`GET /api/monthly-summaries/:id`、`POST /api/monthly-summaries`、`PUT ...`、`DELETE ...`
- `GET /api/summaries`：按 `year_month desc`。
- `POST /api/summaries/generate`：Body `{month:"YYYY-MM"}`，自动聚合日志与采摘数据并 upsert。

#### 3.6 采摘记录

- `POST /api/harvest-records`：Body 包含 `harvest_date`, `fresh_leaf_weight_kg`, `harvest_team.member_count`(≥1)，自动写入 `category_id/name`、`harvest_team_id`。
- `GET /api/harvest-records?month=` / `GET /api/harvest-records/unassigned` / `GET /api/harvest-records/:id`。
- `PUT /api/harvest-records/:id`：同创建逻辑；更新时间/团队/媒体。
- `DELETE /api/harvest-records/:id`。
- `POST /api/harvest-records/sync-weather`：批量同步天气，响应 `{success,data:{total,synced,noData,errors,details[]}}`。

#### 3.7 批次管理

- `POST /api/batches`：创建批次；Body 包含 `batch_number`, `category_name`, `production_steps`, `harvest_records_ids[]`, `tea_master`, `grade` 等。服务端：
  1. 若 `production_steps` 缺失则生成默认模板。
  2. 解析 `tea_master.name`、`grade`，自动填充 FK。
  3. 建立 `batch_harvest_records` 并更新 `harvest_records.assigned_batch_id`。
- `GET /api/batches`（最近 200 条）、`GET /api/batches/:id`。
- `PUT /api/batches/:id`：更新基础字段与 `tea_master_id/grade_id`。
- `PUT /api/batches/:id/production-steps`：整体替换步骤数组。
- `PUT /api/batches/:batchId/steps/:stepIndex/:craftType`：仅更新指定步骤的 `manual_craft` 或 `modern_craft`。
- `DELETE /api/batches/:id`：事务中解除所有关联。

#### 3.8 模板中心 / 等级 / 人员

- 步骤模板：`GET /api/step-templates`、`PUT /api/step-templates/:stepName`
- 批次标题模板：`GET /api/title-templates`、`POST /api/title-templates`
- 鉴赏模板：`GET /api/appreciation-templates`、`PUT /api/appreciation-templates/:categoryName`、`DELETE ...`
- 等级：`GET/POST/PUT/DELETE /api/grades`
- 人员：`GET /api/personnel?role=`、`POST/PUT/DELETE /api/personnel`
- 天气模板 CRUD 同上。

#### 3.9 云养茶园方案

- `GET /api/adoption-plans/:type`：若不存在则初始化默认方案。
- `PUT /api/adoption-plans/:type`：根据类型过滤允许字段再 upsert。  
  - `private`：`marketing_header/value_propositions/customer_cases/scenario_applications/packages/process_steps/comparison_package_names/comparison_features`
  - `enterprise`：`marketing_header/customer_cases/use_scenarios/service_contents/process_steps`
  - `b2b`：`description`

#### 3.10 公共 API（无需登录）

| Endpoint | 说明 |
| --- | --- |
| `GET /api/public/landing-page` | 返回首页需要的地块、品类、CTA、Footer 等集合。 |
| `GET /api/public/growth-data?month=` | 返回 `{month,dailyLogs,monthlySummary}`。 |
| `GET /api/public/monthly-summary?month=` | 指定月份总结。 |
| `GET /api/public/categories` | 从批次表统计已发布品类及数量。 |
| `GET /api/public/weather-templates` | 返回启用模板及 `iconMap`。 |
| `GET /api/public/batches?category&status` / `GET /api/public/batches/:id` | 仅 `status=已发布` 可见。 |
| `GET /api/public/adoption-plans` | 返回三种方案（若缺则自动补默认）。 |

---

### 4. 认证与权限

- **Session 模式**
  - 使用 `express-session`，默认 24h 过期，`secret` 来自环境变量。
  - 登录成功后在 session 中缓存 `{ id, username }`，后续请求通过 `requireLogin` 中间件校验。
  - 所有后台 HTML 页面和 `/api/**` 接口默认加 `requireLogin`，公共 API、登录/忘记密码等路由除外。

- **密码策略**
  - `bcrypt` 哈希，默认 10 轮。
  - 修改密码需校验旧密码；成功后强制重新登录。
  - 忘记密码生成随机 token（GUID），存入 `users.reset_password_token` 与过期时间；重置页面使用 token 参数。

- **权限粒度**
  - 当前系统无多角色 RBAC，所有登录用户具备同等级管理权限。
  - 可在 PostgreSQL 阶段扩展 `roles` 表或在 `users` 中增加 `role` 字段，现阶段保持一致即可。

---

### 5. 特殊逻辑备注

1. **采摘记录自动归类**
   - 保存采摘记录时，以 `harvest_date` 匹配 `tea_categories` 的 `picking_start/end`（跨年情形以同年解析）。若采摘期更新，可通过 `/api/categories/reclassify-harvest-records` 重新批量归属。
   - 未匹配到品类的记录标记为“未分类”，界面可提示调整采摘期或记录日期。

2. **采摘记录团队人数校验**
   - `harvest_team.member_count` 默认 1，且前端、后端、数据库三层都要求 >=1 的整数，违反则返回 `采摘团队人数至少1人`。

3. **天气同步**
   - `/api/harvest-records/sync-weather`：遍历所有采摘记录，按日期查询 `daily_growth_logs`，若有天气信息则写入采摘记录。响应包括 `synced/noData/errors` 统计。
   - 新增/编辑采摘记录时若指定日期存在生长日志也会即时拉取天气。

4. **批次与采摘记录联动**
   - 创建/更新批次时的 `harvest_records_ids` 需在事务中：
     1. 更新联结表 `batch_harvest_records`；
     2. 将对应的 `harvest_records.assigned_batch_id` 指向当前批次；
     3. 若某采摘记录被移除，应清空其 `assigned_batch_id` 并删除联结记录。

5. **月度总结自动生成**
   - `POST /api/summaries/generate` 会根据 `month` 拉取该月的 `daily_growth_logs` 与 `harvest_records`，生成 `harvest_stats`（数量/总重量）、`farm_calendar`（农事列表）、`abnormal_summary`、`climate_summary`、`next_month_plan` 等字段后 upsert。
   - 操作需使用数据库事务避免读写不一致。

6. **云养茶园默认化**
   - 若请求 `GET /api/adoption-plans/:type` 时数据库不存在记录，服务端会创建带默认文案的方案，保证前端始终有数据。
   - 私人定制方案的套餐比对支持动态列：`comparison_package_names` 与 `comparison_features[].values` 长度需同步。新增/删除套餐列时必须同步所有 `values` 元素。

7. **公共缓存策略**
   - 静态 HTML：`Cache-Control: public, max-age=300`。
   - 上传文件：`Cache-Control: public, max-age=2592000, immutable`。
   - 迁移后应保持等效头部，或在 CDN 层统一配置。

8. **上传目录与校验**
   - 目录 `public/uploads/<category>` 需预创建，`category` 仅允许白名单（avatars/personnel/growth/...）。
   - 文件大小限制 50MB，允许常见图片 + MP4/WebM/Ogg/MOV；SVG 仅在天气模板专用上传接口允许。

9. **错误处理**
   - 所有 API 统一返回 JSON 错误（`{success:false,message}`），HTML 页面使用自定义错误页。
   - Prisma 迁移后需保留同样的错误语义（如重复数据、验证失败等）。

---

> ⚙️ **落地建议**：依据本蓝图在 `schema.prisma` 中定义模型 → 自动生成迁移 → 使用 Prisma Client 重写 `server.js` 中的 Mongoose 调用。测试阶段优先验证核心用例（采摘记录归类、批次联动、动态套餐比对、公共 API）确保行为一致。

