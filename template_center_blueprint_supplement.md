## 文件名：`template_center_blueprint_supplement.md`

### 1. MongoDB Collection Schema 详情

#### 1.1 制作步骤模板：`production_step_templates`（Model：`ProductionStepTemplate`）

- **用途**：为“摊晾 / 杀青 / 揉捻 / 干燥 / 分拣”五个标准工艺步骤提供默认文案，在创建/编辑批次时自动填充说明文字。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `step_name` | String | 是，唯一 | 步骤名称，限制为五个标准值之一（业务层通过 `validSteps = ['摊晾','杀青','揉捻','干燥','分拣']` 做校验）；建有索引；全局唯一 |
| `manual_craft` | Object（子文档） | 否 | “手工匠心”工艺描述，结构见下 |
| `modern_craft` | Object（子文档） | 否 | “现代工艺”工艺描述，结构见下 |
| `createdAt` | Date | 自动 | 创建时间（`timestamps: true`） |
| `updatedAt` | Date | 自动 | 更新时间 |

- **子文档 `manual_craft` / `modern_craft` 结构（复杂 JSON 字段）**

两者均复用子 Schema `craftTextSchema`，结构完全一致：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `purpose` | String | 否 | 此步骤的目的 |
| `method` | String | 否 | 操作方法描述 |
| `sensory_change` | String | 否 | 感官变化描述（香气 / 形状 / 颜色等） |
| `value` | String | 否 | 该步骤对最终品质的价值说明 |

> 说明：`craftTextSchema` 设置 `{ _id: false }`，即不会为子文档生成单独 `_id`，整体视为一个嵌套 JSON 对象字段。

---

#### 1.2 批次详情标题模板：`title_templates`（Model：`TitleTemplate`）

- **用途**：为每个“茶叶品类（category_name）”配置一条批次详情标题模板；原本硬编码在前端的映射被迁移到 DB 统一管理。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `category_name` | String | 是，唯一 | 茶叶品类名称，长度 2–50；对应该系统中的 `TeaCategory` 业务概念 |
| `title_template` | String | 是 | 标题模板本身，如“明前·山头名称·年份·批次号”等诗意标题 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **索引与虚拟字段**

  - 唯一索引：`index({ category_name: 1 }, { unique: true })`
  - 时间索引：`index({ createdAt: -1 })`
  - 虚拟属性：
    - `templateLength`：`title_template` 长度
    - `isLongTitle`：布尔，标题长度是否 > 30
  - 虚拟属性默认包含在 JSON / Object 输出：`set('toJSON', { virtuals: true })` 等

---

#### 1.3 鉴赏模板：`appreciation_templates`（Model：`AppreciationTemplate`）

- **用途**：为不同茶叶品类存储成品鉴赏页的默认文案，包括品鉴笔记、冲泡建议和储存方法。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `category_name` | String | 是，唯一 | 茶叶品类名称，长度 2–50，去空格；作为业务主键 |
| `tasting_notes` | String | 否 | 品鉴笔记（外形 / 汤色 / 香气 / 滋味 / 叶底等） |
| `brewing_suggestion` | String | 否 | 冲泡建议（温度 / 茶水比 / 时间 / 器具） |
| `storage_method` | String | 否 | 储存方式与保质建议 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **索引与虚拟字段**

  - 唯一索引：`index({ category_name: 1 }, { unique: true })`
  - 时间索引：`index({ createdAt: -1 })`
  - 虚拟属性：
    - `shortTastingNotes`：品鉴笔记前 100 字的摘要（超过 100 字会追加 `...`）
  - 虚拟属性同样通过 `toJSON/toObject` 暴露

> 所有字段都是简单字符串，没有额外嵌套 JSON，但单条文案长度上限较大（品鉴笔记 ≤ 2000；冲泡建议、储存方法 ≤ 1000），适合富文案配置。

---

#### 1.4 天气模板：`weather_templates`（Model：`WeatherTemplate`）

- **用途**：统一管理天气选项及对应 SVG 图标，供“成长日志”、“月度总结”等模块选择天气，并供前台公开 API 使用。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `name` | String | 是，唯一 | 天气名称，如“晴”、“阴”、“小雨”等 |
| `svg_icon` | String | 否 | SVG 图标的 URL 或完整 SVG 源码（字符串）——这是一个**可能体积较大和结构复杂的字符串字段** |
| `temperature_range` | String | 否 | 温度范围建议描述，如 `"15-25°C"` |
| `description` | String | 否 | 描述文案，≤ 200 字 |
| `sort_order` | Number | 否，默认 0 | 排序字段，用于前端选择器排序展示，>= 0 |
| `is_active` | Boolean | 否，默认 true | 是否启用该天气选项 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **索引与虚拟字段**

  - 索引：
    - `index({ sort_order: 1, name: 1 })`
    - `index({ is_active: 1 })`
    - `index({ createdAt: -1 })`
  - 虚拟属性：
    - `hasIcon`：布尔，是否配置了 `svg_icon`
  - `pre('save')` 钩子：对 `name` 做唯一性检查，防止重复天气名称。

> 复杂字段说明：`svg_icon` 既可以存 URL，也可以存完整 SVG 源代码（大段 XML 字符串）。在迁移到 PostgreSQL 时需要特别注意字段类型（建议 `TEXT`）。

---

#### 1.5 人员管理模板：`personnel`（Model：`Personnel`）

> 虽名为“人员管理”，从模板中心的视角，它是“人员选项字典表（Template/Dictionary）”，供其他模块通过下拉选择使用。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `name` | String | 是 | 人员姓名，2–50 字 |
| `avatar_url` | String | 否 | 头像 URL，存储在 `public/uploads/avatars` / `personnel` 等目录下 |
| `role` | String（枚举） | 是 | 角色，`'记录人' \| '采摘队长' \| '制茶师'` |
| `experience_years` | Number | 否，默认 0 | 经验年限（整数，0–100） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **索引与虚拟字段**

  - 索引：
    - 复合唯一索引：`index({ role: 1, name: 1 }, { unique: true })` —— 同一角色下，姓名唯一
    - `index({ role: 1 })`
    - `index({ createdAt: -1 })`
  - 虚拟字段（用于展示）：
    - `hasAvatar`：是否配置头像
    - `displayName`：`"姓名 (角色)"` 文本
    - `experienceDescription`：按年限映射为“新手 / 初级 / 中级 / 高级 / 资深专家”

---

#### 1.6 等级管理模板：`grades`（Model：`Grade`）

- **用途**：作为产品等级字典表（如“一等、特等”等），批次管理中可直接选择。

- **字段定义**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `name` | String | 是，唯一 | 等级名称，2–50 字 |
| `badge_url` | String | 否 | 徽章图片 URL（`public/uploads/products` / 其他路径） |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **索引与虚拟字段**

  - 唯一索引：`index({ name: 1 }, { unique: true })`
  - 时间索引：`index({ createdAt: -1 })`
  - 虚拟字段：
    - `hasBadge`：是否配置了徽章图片

---

#### 1.7 云养茶园领养方案（扩展配置）：`adoption_plans`（Model：`AdoptionPlan`）

> 该 Model 主要服务于“云养茶园领养方案”配置页和对外落地页展示，本质上也是一类**复杂配置模板**；不在模板中心入口中直连，但属于同一“模板/配置”域，建议在 PostgreSQL 设计时一并规划。

- **顶层字段**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | ObjectId | 是 | 主键 |
| `type` | String（枚举） | 是，唯一 | 方案类型：`'private'`（私人定制） / `'enterprise'`（企业领养） / `'b2b'`（B 端合作） |
| `marketing_header` | Object | 否 | 页面营销标题（title/subtitle），三类方案共用结构 |
| `value_propositions` | Array\<Object\> | 仅 `private` 使用 | “核心价值主张”列表 |
| `customer_cases` | Array\<Object\> | `private` & `enterprise` | 客户案例（图 + 文） |
| `scenario_applications` | Array\<Object\> | 主要用于 `private` | 场景化应用配置 |
| `packages` | Array\<Object\> | 仅 `private` | 定制套餐配置 |
| `comparison_package_names` | Array\<String\> | 仅 `private` | 套餐名称列表（用于对比表头） |
| `comparison_features` | Array\<Object\> | 仅 `private` | 套餐对比行配置 |
| `process_steps` | Array\<Object\> | `private` & `enterprise` | 领养 / 合作流程步骤 |
| `use_scenarios` | Array\<Object\> | 仅 `enterprise` | 企业使用场景 |
| `service_contents` | Array\<Object\> | 仅 `enterprise` | 服务内容列表 |
| `description` | String | 仅 `b2b` | B 端合作方案整体介绍 |
| `createdAt` | Date | 自动 | 创建时间 |
| `updatedAt` | Date | 自动 | 更新时间 |

- **子文档结构（复杂 JSON 字段）**

  - `marketing_header`（`marketingHeaderSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `title` | String | 主标题 |
    | `subtitle` | String | 副标题 |

  - `value_propositions` 元素（`valuePropositionSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | 图标 Emoji 或图标类 |
    | `title` | String | 标题 |
    | `description` | String | 描述文案 |

  - `customer_cases` 元素（`customerCaseSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `image_url` | String | 图片或视频封面 URL |
    | `text` | String | 文本说明 |
    | `media_type` | String（枚举） | `'image'` / `'video'` |

  - `scenario_applications` 元素（`scenarioApplicationSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | 场景主图标，如 🎁 |
    | `background_image` | String | 背景图片 URL |
    | `title` | String | 场景标题，如“节日礼赠” |
    | `pain_point` | String | 场景痛点文案 |
    | `solution` | String | 场景解决方案描述 |
    | `core_values` | Array\<Object\> | 核心价值数组，每项为 `scenarioCoreValueSchema` |
    | `content` | String | 旧版兼容字段：内容 |
    | `application` | String | 旧版兼容字段：应用 |
    | `effect` | String | 旧版兼容字段：效果 |

  - `scenario_core_values` 元素（`scenarioCoreValueSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | Emoji 图标，如 🎯 |
    | `title` | String | 文本标题 |
    | `description` | String | 详细说明 |

  - `packages` 元素（`packageSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `name` | String | 套餐名称 |
    | `price` | String | 价格描述（文本） |
    | `target_audience` | String | 目标人群 |
    | `area_features` | String | 茶园面积/资源特性 |
    | `exclusive_output` | String | 专属产出 |
    | `tagline` | String | Slogan |
    | `features` | String | 功能亮点文本 |
    | `rights` | Array\<Object\> | 套餐权益列表，结构为 `packageRightSchema` |

  - `packageRightSchema` 元素

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | 权益图标 |
    | `title` | String | 权益标题 |
    | `description` | String | 权益说明 |

  - `comparison_features` 元素（`comparisonFeatureSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | 特性图标 |
    | `feature_name` | String | 特性名，如“年产量”、“定制包装”等 |
    | `values` | Array\<String\> | 各套餐对应值列表，与 `comparison_package_names` 顺序一致 |

  - `process_steps` 元素（`processStepSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `step` | String | 步骤编号或短标识 |
    | `title` | String | 步骤标题 |
    | `description` | String | 步骤说明 |

  - `service_contents` 元素（`serviceContentSchema`）

    | 字段 | 类型 | 说明 |
    |------|------|------|
    | `icon` | String | 图标 |
    | `title` | String | 服务标题 |
    | `description` | String | 服务内容说明 |

> 该集合整体是**高度结构化的 JSON 配置**，迁移到 PostgreSQL 时建议使用 JSONB 字段存储上述嵌套结构，或拆分为多张从表。

---

### 2. 核心业务逻辑与关联关系

#### 2.1 模板中心在整体系统中的角色

- **定位**：提供多个“字典/模板/配置表”，以**“数据驱动 UI 和默认文案”**，从而：
  - 在创建或编辑业务实体（批次、成长日志、采摘记录等）时自动填充默认值；
  - 在前台展示（成品鉴赏 / 云养茶园落地页 / 公共天气图标等）时统一风格和内容；
  - 减少硬编码，提高可配置程度。

模块划分（从 `template-hub.html` 和 `server.js` 的路由）：

- 制作步骤模板 → `ProductionStepTemplate`
- 批次详情标题模板 → `TitleTemplate`
- 鉴赏模板 → `AppreciationTemplate`
- 人员管理模板 → `Personnel`
- 等级管理模板 → `Grade`
- 天气模板 → `WeatherTemplate`
- 云养茶园领养方案（扩展配置） → `AdoptionPlan`（入口在 `/admin/adoption-management`，但性质与模板/配置一致）

---

#### 2.2 与核心业务模块（Tea / Batch / Growth / Harvest 等）的关联方式

**1）与茶叶品类 `TeaCategory` 的关系**

- `TitleTemplate.category_name` 与 `AppreciationTemplate.category_name` 都是**按品类名称进行逻辑关联**：
  - 创建 / 编辑批次时，前端会根据选择的品类（来自 `TeaCategory`）：
    - 调用 `GET /api/title-templates` → 找到匹配的 `category_name` → 自动填充批次标题。
    - 调用 `GET /api/appreciation-templates` → 按品类拉取对应成品鉴赏默认文案。
  - 这种关联在 MongoDB 层面**没有外键**，完全由业务 / 前端按字符串匹配控制，迁移 PostgreSQL 时可以：
    - 保持“弱关联”（仍用名称字段匹配），或
    - 升级为“外键关联到 TeaCategory(id)”（推荐做法，需要调整 Schema）。

**2）与批次 `Batch` 的关系**

- 制作步骤模板：
  - API 注释：`GET /api/step-templates` 被“创建/编辑批次”调用，用于“自动填充默认文案”。
  - 业务逻辑：创建新批次时，前端会拉取 `ProductionStepTemplate.getAllTemplates()`，然后把其中 `manual_craft/modern_craft` 的文本**复制**到当前批次的工艺步骤字段中。
  - 关键点：模板数据**不会被批次用 `_id` 引用，而是内容拷贝**，以免后续模板修改影响历史批次。

- 等级模板：
  - `GET /api/grades` 注释说明“同时被‘等级管理’和“批次编辑”调用”。
  - 批次编辑时通过该列表渲染下拉框，存储在 `Batch` 中的一般是 `grade_id` 或 `grade_name`（具体字段在 `Batch.js`，本蓝图范围外），但逻辑上视为**从 `Grade` 字典表选一项**。

**3）与成长日志 / 月度总结 / 采摘记录 等的关系**

- 天气模板：
  - `GET /api/weather-templates` 提供后台选择；`GET /api/public/weather-templates` 提供给**公开前台网站**用来渲染天气图标。
  - 业务层典型使用场景：
    - 日常生长日志（`DailyGrowthLog`）和月度总结（`MonthlySummary`）记录天气字段；
    - 前端使用 `WeatherTemplate` 中的 `name + svg_icon` 做展示。
  - 同样是**内容字典模式**：业务实体中通常仅存天气名称或 ID，展示时再通过模板表映射到 SVG 和说明。

- 人员模板：
  - 在 `server.js` 的成长日志新增/更新逻辑中：
    - 根据 `logData.recorder_name` 去 `Personnel` 中用 `{ name, role: '记录人' }` 查找对应记录；
    - 若存在，会填充 `recorder_id` 等字段。
  - 批次、采摘记录中类似使用“采摘队长”、“制茶师”等角色。
  - 这形成一种**半强关联**：
    - 业务实体可仅保存字符串（人名），也可以保存 `personnel_id` 以便统计；
    - 模板中心负责**统一人员信息来源**。

**4）云养茶园方案与前台站点的关系**

- `AdoptionPlan`：
  - 后台管理 API：`GET /api/adoption-plans/:type`、`PUT /api/adoption-plans/:type` 用于 CMS 配置。
  - 公开 API：`GET /api/public/adoption-plans` 直接为前端落地页提供完整 JSON。
  - 与 Tea / Batch 等**没有直接外键**，更多是品牌营销维度的内容配置。

---

#### 2.3 核心业务逻辑小结（典型流程）

- **创建/编辑批次**
  - 调用 `GET /api/step-templates` → 将五个标准步骤的模板文案拷贝到新批次的工艺步骤中（而不是引用 ID）。
  - 调用 `GET /api/title-templates` → 根据批次选择的茶叶品类自动生成批次标题默认值。
  - 调用 `GET /api/appreciation-templates` → 为成品鉴赏区域提供初始文案（品鉴笔记/冲泡建议/储存方法）。
  - 调用 `GET /api/grades` → 渲染等级下拉选项，保存所选等级到批次。

- **填写成长日志 / 采摘记录 / 制作记录**
  - 调用 `GET /api/personnel?role=记录人|采摘队长|制茶师` → 渲染人员下拉列表，填入记录人、队长、制茶师。
  - 调用 `GET /api/weather-templates?active_only=true` → 渲染天气选择器，并在 UI 中展示对应 SVG。

- **前台公开页面**
  - 调用 `GET /api/public/weather-templates` → 获取所有启用的天气模板及 `iconMap`，在公开站点渲染天气图标。
  - 调用 `GET /api/public/adoption-plans` → 获取三类云养茶园领养方案的完整配置，用于前端静态/动态渲染。

---

### 3. 与模板中心相关的 API 路由定义

> 以下均来自 `server.js`，仅列出与模板/配置域相关的路由，并按“页面路由 / 管理 API / 公开 API”分组。

#### 3.1 后台页面路由（HTML）

- **`GET /admin/template-management`**
  - 说明：模板管理中心门户页。
  - 返回：`views/template-hub.html`，展示所有模板卡片入口。

- **`GET /admin/step-templates`**
  - 说明：制作步骤模板管理页面。
  - 返回：`views/template-management.html`，用于编辑 `ProductionStepTemplate`。

- **`GET /admin/title-templates`**
  - 说明：批次详情标题模板管理页面。
  - 返回：`views/title-template-management.html`，用于管理 `TitleTemplate`。

- **`GET /admin/appreciation-templates`**
  - 说明：鉴赏模板管理页面。
  - 返回：`views/appreciation-template-management.html`，用于管理 `AppreciationTemplate`。

- **`GET /admin/personnel-management`**
  - 说明：人员管理模版页面，用于统一管理记录人/采摘队长/制茶师。
  - 返回：`views/personnel-management.html`，管理 `Personnel`。

- **`GET /admin/grade-management`**
  - 说明：等级管理模板页面。
  - 返回：`views/grade-management.html`，管理 `Grade`。

- **`GET /admin/weather-templates`**
  - 说明：天气模板管理页面。
  - 返回：`views/weather-template-management.html`，管理 `WeatherTemplate`。

- **（扩展）`GET /admin/adoption-management`**
  - 说明：云养茶园领养方案管理页面（虽不在 template-hub 卡片里，但属于配置域）。
  - 返回：`views/adoption-management.html`（根据项目文件，可推断）。

---

#### 3.2 制作步骤模板 API

- **`GET /api/step-templates`**
  - 权限：需登录。
  - 功能：获取所有制作步骤模板，按预设顺序（`['摊晾','杀青','揉捻','干燥','分拣']`）排序，用于批次创建/编辑时自动填充文案。
  - 返回：
    - `data`: 模板数组（`ProductionStepTemplate` 文档）
    - `count`: 模板数量

- **`PUT /api/step-templates/:stepName`**
  - 权限：需登录。
  - 参数：
    - URL：`stepName` 必须是五个标准步骤之一。
    - Body：`manual_craft`、`modern_craft` 子文档对象。
  - 功能：更新（或 upsert 创建）指定步骤的模板文案。
  - 返回：更新后的模板文档。

---

#### 3.3 批次详情标题模板 API

- **`GET /api/title-templates`**
  - 权限：需登录。
  - 功能：获取所有批次详情标题模板，模板中心页面和批次编辑页面都会调用。
  - 返回：
    - `data`: `TitleTemplate` 数组（按 `category_name` 排序）
    - `count`: 数量

- **`POST /api/title-templates`**
  - 权限：需登录。
  - Body：`{ templates: Array<{ category_name, title_template }> }`
  - 功能：**批量 upsert** 所有标题模板：
    - 验证数组格式；
    - 验证每条数据的 `category_name`、`title_template` 是否存在；
    - 使用 `findOneAndUpdate({ category_name }, { ... }, { upsert: true })` 并发更新。
  - 返回：更新后的文档数组及 `count`。

---

#### 3.4 鉴赏模板 API

- **`GET /api/appreciation-templates`**
  - 权限：需登录。
  - 功能：获取所有鉴赏模板，供模板中心页面和批次编辑页面使用。
  - 返回：
    - `data`: `AppreciationTemplate` 数组（按 `category_name` 排序）
    - `count`: 数量

- **`PUT /api/appreciation-templates/:categoryName`**
  - 权限：需登录。
  - 参数：
    - URL：`categoryName`（品类名称）
    - Body：`tasting_notes`、`brewing_suggestion`、`storage_method`
  - 功能：upsert 指定品类的鉴赏模板。
  - 返回：更新后的模板文档。

- **`DELETE /api/appreciation-templates/:categoryName`**
  - 权限：需登录。
  - 功能：删除指定品类的鉴赏模板，若不存在则返回 404。
  - 返回：被删除的模板文档。

---

#### 3.5 人员管理 API（作为模板/字典）

- **`GET /api/personnel`**
  - 权限：需登录。
  - Query：`role`（可选，`记录人|采摘队长|制茶师`）。
  - 功能：
    - 若传 `role`，则通过 `Personnel.findByRole(role)` 获取对应角色列表；
    - 否则获取所有人员。
  - 返回：`data` 为人员数组，`count` 为数量。

- **`POST /api/personnel`**
  - 权限：需登录。
  - Body：`name`、`avatar_url`（可选）、`role`、`experience_years` 等。
  - 功能：新增人员：
    - 校验是否缺少 `name` 或 `role`；
    - 校验 `role` 是否为 3 个合法值之一；
    - 创建并保存新 `Personnel` 文档。
  - 冲突处理：若同一角色下存在同名人员，会由 schema 的 pre-save 校验抛错，并被转成 400 响应。

- **`PUT /api/personnel/:id`**
  - 权限：需登录。
  - 功能：根据 ID 更新人员信息（修改姓名、头像、角色、经验年限）。

- **`DELETE /api/personnel/:id`**
  - 权限：需登录。
  - 功能：删除指定人员。

---

#### 3.6 等级管理 API（作为模板/字典）

- **`GET /api/grades`**
  - 权限：需登录。
  - 功能：获取所有等级，供“等级管理”页面和“批次编辑”页面使用。
  - 返回：`data` 为 `Grade` 数组，`count` 为数量。

- **`POST /api/grades`**
  - 权限：需登录。
  - Body：`name`、`badge_url`。
  - 功能：
    - 校验 `name` 非空；
    - 使用 `Grade.findByName` 检查是否重名；
    - 创建新等级并保存。
  - 典型错误：
    - 名称重复 / 验证错误返回 400。

- **`PUT /api/grades/:id`**
  - 权限：需登录。
  - 功能：更新指定 ID 的等级（修改名称和徽章）。

- **`DELETE /api/grades/:id`**
  - 权限：需登录。
  - 功能：删除某个等级；若被业务引用，需要业务层自行保证安全删除。

---

#### 3.7 天气模板 API

- **`GET /api/weather-templates`**
  - 权限：需登录。
  - Query：`active_only=true|false`。
  - 功能：
    - 若 `active_only=true`：调用 `WeatherTemplate.findActiveWeathers()` 获取启用项；
    - 否则：调用 `WeatherTemplate.findAllWeathers()` 获取所有。
  - 返回：`data` 为模板数组，`count` 为数量。

- **`POST /api/weather-templates`**
  - 权限：需登录。
  - Body：`name`、`svg_icon`、`temperature_range`、`description`、`sort_order`、`is_active`。
  - 功能：创建新天气模板，`name` 必填、唯一；`is_active` 默认为 `true`（除非显式传 `false`）。

- **`PUT /api/weather-templates/:id`**
  - 权限：需登录。
  - 功能：按 ID 更新天气模板：
    - 校验 ID 合法性；
    - 校验 `name` 非空；
    - 若不存在则 404；
    - 更新所有字段并保存。

- **`DELETE /api/weather-templates/:id`**
  - 权限：需登录。
  - 功能：删除指定天气模板（先校验 ID 与是否存在）。

- **`POST /api/weather-templates/upload-icon`**
  - 权限：需登录。
  - 功能：上传 SVG 图标文件：
    - 使用 `multer` 接收 `svg_file`；
    - 校验扩展名为 `.svg`，否则删除上传文件并返回错误；
    - 确保文件位于 `uploads/weather` 目录（必要时移动文件）；
    - 返回可用于 `svg_icon` 字段的 URL/路径。

- **公开 API：`GET /api/public/weather-templates`**
  - 权限：公开（无需登录）。
  - 功能：
    - 获取所有启用的天气模板；
    - 构建 `weatherIconMap`，将天气名称映射到 SVG 图标 URL；
    - 返回：
      - `templates`: 启用模板列表；
      - `iconMap`: 名称→图标 URL 映射（供前台站点使用）。

---

#### 3.8 云养茶园领养方案 API（扩展配置）

- **`GET /api/adoption-plans/:type`**
  - 权限：需登录。
  - 参数：`type` = `'private' | 'enterprise' | 'b2b'`。
  - 功能：获取指定类型的领养方案；若不存在，则用 `AdoptionPlan.getDefaultData(type)` 自动创建默认数据并返回。

- **`PUT /api/adoption-plans/:type`**
  - 权限：需登录。
  - 参数：`type` 同上。
  - Body：完整的方案配置对象（包含营销标题、核心价值、场景化应用、套餐、对比表等）。
  - 功能：
    - 根据 `type` 过滤允许更新的字段；
    - 使用 `findOneAndUpdate({ type }, updateData, { upsert: true, runValidators: true })` 做 upsert；
    - 日志中详细记录场景数量、套餐比对信息等，便于调试。

- **公开 API：`GET /api/public/adoption-plans`**
  - 权限：公开。
  - 功能：
    - 获取所有类型的方案并自动补齐缺失的默认方案；
    - 返回数据结构：
      - `data.private`
      - `data.enterprise`
      - `data.b2b`
    - 用于云养茶园的前台落地页一次性获取所有配置。

---

### 4. PostgreSQL 目标建模与迁移注意事项（模板中心专用补充）

> 本节是在前述 MongoDB 结构之上的**PostgreSQL 设计建议**，方便在整体重构蓝图中直接落地实现。

---

#### 4.1 总体建模策略

- **划分规则**
  - **简单字典类**（人员、等级、天气） → 直接一表一实体；
  - **模板类**（步骤模板、标题模板、鉴赏模板） → 一表一实体，适当增加外键到 `tea_categories`；
  - **高度嵌套配置类**（`AdoptionPlan`） → 建议拆为“主表 + 多张子表”，而不是单个 JSONB 字段（利于统计与查询）。

- **ID 策略**
  - 统一使用 `BIGSERIAL` 作为主键，Mongo 的 `_id` 不再保留；
  - 如需要兼容旧数据，可增加 `legacy_mongo_id TEXT` 字段存历史 `_id`（可选）。

---

#### 4.2 制作步骤模板 `production_step_templates`

##### 4.2.1 表结构建议

```sql
CREATE TABLE production_step_templates (
    id              BIGSERIAL PRIMARY KEY,
    step_name       TEXT NOT NULL UNIQUE,  -- '摊晾' / '杀青' / '揉捻' / '干燥' / '分拣'
    manual_purpose  TEXT NOT NULL DEFAULT '',
    manual_method   TEXT NOT NULL DEFAULT '',
    manual_sensory_change TEXT NOT NULL DEFAULT '',
    manual_value    TEXT NOT NULL DEFAULT '',
    modern_purpose  TEXT NOT NULL DEFAULT '',
    modern_method   TEXT NOT NULL DEFAULT '',
    modern_sensory_change TEXT NOT NULL DEFAULT '',
    modern_value    TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **说明**
  - 由于 `manual_craft` / `modern_craft` 结构固定，拆成扁平列更利于查询与排序；
  - `step_name` 可增加 CHECK 约束限制在五个合法值内，或保持由业务层控制。

---

#### 4.3 批次详情标题模板 `title_templates`

##### 4.3.1 表结构建议

```sql
CREATE TABLE title_templates (
    id              BIGSERIAL PRIMARY KEY,
    tea_category_id BIGINT REFERENCES tea_categories(id), -- 建议新增外键
    category_name   TEXT NOT NULL UNIQUE,                 -- 兼容旧逻辑，可与 tea_categories.name 对应
    title_template  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **迁移建议**
  - 若已存在 `tea_categories` 表：
    - 先按 `category_name` 与 `tea_categories.name` 进行匹配，填充 `tea_category_id`；
    - 迁移完成后，前端可优先用 `tea_category_id` 做关联，`category_name` 保留作展示/冗余字段。

---

#### 4.4 鉴赏模板 `appreciation_templates`

##### 4.4.1 表结构建议

```sql
CREATE TABLE appreciation_templates (
    id                  BIGSERIAL PRIMARY KEY,
    tea_category_id     BIGINT REFERENCES tea_categories(id),
    category_name       TEXT NOT NULL UNIQUE,
    tasting_notes       TEXT NOT NULL DEFAULT '',
    brewing_suggestion  TEXT NOT NULL DEFAULT '',
    storage_method      TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **注意**
  - 三段文案长度较长，统一使用 `TEXT`；
  - 同样建议在迁移时回填 `tea_category_id`，后续业务更新统一走 ID 关联。

---

#### 4.5 天气模板 `weather_templates`

##### 4.5.1 表结构建议

```sql
CREATE TABLE weather_templates (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    svg_icon            TEXT NOT NULL DEFAULT '',  -- 可存 URL 或 SVG 源码
    temperature_range   TEXT NOT NULL DEFAULT '',
    description         TEXT NOT NULL DEFAULT '',
    sort_order          INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **注意**
  - `svg_icon` 使用 `TEXT` 即可，足以容纳完整 SVG；
  - 对公开 API `GET /api/public/weather-templates` 来说，表结构无需额外拆分。

---

#### 4.6 人员字典表 `personnel`

##### 4.6.1 表结构建议

```sql
CREATE TYPE personnel_role AS ENUM ('记录人', '采摘队长', '制茶师');

CREATE TABLE personnel (
    id                 BIGSERIAL PRIMARY KEY,
    name               TEXT NOT NULL,
    avatar_url         TEXT NOT NULL DEFAULT '',
    role               personnel_role NOT NULL,
    experience_years   INTEGER NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_personnel_role_name UNIQUE (role, name)
);
```

- **与业务表关联**
  - 成长日志/采摘/批次等表中，可增加：
    - `recorder_id BIGINT REFERENCES personnel(id)`
    - `leader_id BIGINT REFERENCES personnel(id)`
    - `craftsman_id BIGINT REFERENCES personnel(id)`
  - 现有按姓名查找的逻辑可逐步替换为按 ID 关联。

---

#### 4.7 等级模板 `grades`

##### 4.7.1 表结构建议

```sql
CREATE TABLE grades (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    badge_url   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **与批次表关系**
  - 在 `batches` 表中增加：
    - `grade_id BIGINT REFERENCES grades(id)`（替代仅存字符串的方式）；
  - 迁移时，可通过 `grade_name` 与 `grades.name` 映射回填 `grade_id`。

---

#### 4.8 云养茶园领养方案：从单集合到多表设计

> 这是最复杂的模板/配置实体，强烈建议在 PostgreSQL 中拆表建模，而不是整个对象塞进一个 JSONB。

##### 4.8.1 主表：`adoption_plans`

```sql
CREATE TYPE adoption_plan_type AS ENUM ('private', 'enterprise', 'b2b');

CREATE TABLE adoption_plans (
    id          BIGSERIAL PRIMARY KEY,
    type        adoption_plan_type NOT NULL UNIQUE,
    title       TEXT NOT NULL DEFAULT '',   -- marketing_header.title
    subtitle    TEXT NOT NULL DEFAULT '',   -- marketing_header.subtitle
    description TEXT NOT NULL DEFAULT '',   -- B2B 方案整体描述
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### 4.8.2 核心价值主张表（仅 private）：`adoption_value_propositions`

```sql
CREATE TABLE adoption_value_propositions (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT ''
);
```

##### 4.8.3 客户案例表（private & enterprise）：`adoption_customer_cases`

```sql
CREATE TYPE adoption_media_type AS ENUM ('image', 'video');

CREATE TABLE adoption_customer_cases (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    image_url       TEXT NOT NULL DEFAULT '',
    text            TEXT NOT NULL DEFAULT '',
    media_type      adoption_media_type NOT NULL DEFAULT 'image'
);
```

##### 4.8.4 场景化应用表：`adoption_scenarios` + 核心价值表

```sql
CREATE TABLE adoption_scenarios (
    id                  BIGSERIAL PRIMARY KEY,
    plan_id             BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    icon                TEXT NOT NULL DEFAULT '',
    background_image    TEXT NOT NULL DEFAULT '',
    title               TEXT NOT NULL DEFAULT '',
    pain_point          TEXT NOT NULL DEFAULT '',
    solution            TEXT NOT NULL DEFAULT '',
    legacy_content      TEXT NOT NULL DEFAULT '',   -- 对应旧字段 content
    legacy_application  TEXT NOT NULL DEFAULT '',   -- 旧字段 application
    legacy_effect       TEXT NOT NULL DEFAULT ''    -- 旧字段 effect
);

CREATE TABLE adoption_scenario_core_values (
    id              BIGSERIAL PRIMARY KEY,
    scenario_id     BIGINT NOT NULL REFERENCES adoption_scenarios(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT ''
);
```

##### 4.8.5 套餐与权益：`adoption_packages` + `adoption_package_rights`

```sql
CREATE TABLE adoption_packages (
    id                  BIGSERIAL PRIMARY KEY,
    plan_id             BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    name                TEXT NOT NULL DEFAULT '',
    price               TEXT NOT NULL DEFAULT '',
    target_audience     TEXT NOT NULL DEFAULT '',
    area_features       TEXT NOT NULL DEFAULT '',
    exclusive_output    TEXT NOT NULL DEFAULT '',
    tagline             TEXT NOT NULL DEFAULT '',
    features            TEXT NOT NULL DEFAULT ''
);

CREATE TABLE adoption_package_rights (
    id              BIGSERIAL PRIMARY KEY,
    package_id      BIGINT NOT NULL REFERENCES adoption_packages(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT ''
);
```

##### 4.8.6 套餐对比配置：`adoption_comparison_packages` + `adoption_comparison_features`

```sql
CREATE TABLE adoption_comparison_packages (
    id         BIGSERIAL PRIMARY KEY,
    plan_id    BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    name       TEXT NOT NULL DEFAULT ''  -- '标准套餐'/'尊享套餐'/'VIP套餐' 等
);

CREATE TABLE adoption_comparison_features (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT NOT NULL DEFAULT '',
    feature_name    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE adoption_comparison_values (
    id              BIGSERIAL PRIMARY KEY,
    feature_id      BIGINT NOT NULL REFERENCES adoption_comparison_features(id) ON DELETE CASCADE,
    package_id      BIGINT NOT NULL REFERENCES adoption_comparison_packages(id) ON DELETE CASCADE,
    value           TEXT NOT NULL DEFAULT ''
);
```

##### 4.8.7 流程步骤：`adoption_process_steps`

```sql
CREATE TABLE adoption_process_steps (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    step            TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT ''
);
```

##### 4.8.8 服务内容（enterprise）：`adoption_service_contents`

```sql
CREATE TABLE adoption_service_contents (
    id              BIGSERIAL PRIMARY KEY,
    plan_id         BIGINT NOT NULL REFERENCES adoption_plans(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT ''
);
```

---

#### 4.9 迁移步骤建议（只针对模板中心模块）

- **步骤 1：建立所有目标表结构**
  - 按上文建议建好所有模板相关表，保持 `created_at/updated_at` 字段以兼容现有日志需求。

- **步骤 2：从 MongoDB 导出数据**
  - 按 collection：
    - `production_step_templates`
    - `title_templates`
    - `appreciation_templates`
    - `weather_templates`
    - `personnel`
    - `grades`
    - `adoption_plans`（需在应用层或脚本中展开嵌套结构，插入到多张表）。

- **步骤 3：映射 TeaCategory / Grade / Personnel 外键**
  - 先将目标表中的 `category_name` / `name` 与对应主表做匹配，生成 ID；


