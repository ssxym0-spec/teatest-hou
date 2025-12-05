import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import {
  PrismaClient,
  FarmActivityType,
  BatchStatus,
  AdoptionPlanType,
  PersonnelRole,
  SettingCategory,
  SettingDataType,
} from '@prisma/client';
import { v5 as uuidv5 } from 'uuid';

const OLD_MONGO_URL = process.env.OLD_MONGO_URL;

if (!OLD_MONGO_URL) {
  throw new Error(
    '环境变量 OLD_MONGO_URL 未配置，请在项目根目录 .env 中添加 OLD_MONGO_URL="mongodb://localhost:27017/tea-garden"',
  );
}

const prisma = new PrismaClient();

type MongoConnection = {
  client: MongoClient;
  db: Db;
};

const legacyPlotIdToNewId = new Map<string, string>();
const legacyPersonnelIdToNewId = new Map<string, string>();
const legacyBatchIdToNewId = new Map<string, string>();
const LEGACY_UUID_NAMESPACE = '6c04e2a4-3ce5-4bf4-9252-4e0b3e6f8de4';

const settingCategoryValues = new Set<string>(Object.values(SettingCategory));
const settingDataTypeValues = new Set<string>(Object.values(SettingDataType));

function toLegacyId(raw: any): string | null {
  if (!raw) return null;
  return String(raw);
}

function legacyIdToUuid(legacyId: string | null | undefined): string | null {
  if (!legacyId) return null;
  try {
    return uuidv5(String(legacyId), LEGACY_UUID_NAMESPACE);
  } catch (error) {
    console.warn(`   ⚠️ 无法为 legacyId=${legacyId} 生成 UUID:`, error);
    return null;
  }
}

function normalizeSettingCategory(raw: any): SettingCategory {
  if (typeof raw !== 'string') {
    return SettingCategory.general;
  }

  const normalized = raw.toLowerCase();
  return settingCategoryValues.has(normalized)
    ? (normalized as SettingCategory)
    : SettingCategory.general;
}

function normalizeSettingDataType(raw: any): SettingDataType {
  if (typeof raw !== 'string') {
    return SettingDataType.string;
  }

  const normalized = raw.toLowerCase();
  return settingDataTypeValues.has(normalized)
    ? (normalized as SettingDataType)
    : SettingDataType.string;
}

async function connectOldMongo(): Promise<MongoConnection> {
  const client = new MongoClient(OLD_MONGO_URL!);
  await client.connect();
  const db = client.db();
  console.log(`✅ 已连接旧 MongoDB 数据库: ${db.databaseName}`);
  return { client, db };
}

async function migrateUsers(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移用户 (users)...');
  const docs = (await db.collection('users').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const { username, password } = doc;
    if (!username || !password) {
      console.warn(`   ⚠️ 跳过无效用户 _id=${legacyId}`);
      continue;
    }

    await client.user.upsert({
      where: { username },
      update: {
        passwordHash: password,
        resetPasswordToken: doc.resetPasswordToken ?? null,
        resetPasswordExpires: doc.resetPasswordExpires ?? null,
      },
      create: {
        username,
        passwordHash: password,
        resetPasswordToken: doc.resetPasswordToken ?? null,
        resetPasswordExpires: doc.resetPasswordExpires ?? null,
      },
    });

    console.log(`   ✅ 用户 ${username} (legacy _id=${legacyId})`);
  }
}

async function migrateTeaCategories(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移茶叶品类 (tea_categories)...');
  const docs = (await db.collection('tea_categories').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const { name, slug } = doc;
    if (!name || !slug) {
      console.warn(`   ⚠️ 跳过无效品类 _id=${legacyId}`);
      continue;
    }

    const yieldPercentage =
      typeof doc.yield_percentage === 'number' ? doc.yield_percentage : 0;

    await client.teaCategory.upsert({
      where: { name },
      update: {
        slug,
        imageUrl: doc.image_url ?? null,
        description: doc.description ?? null,
        yieldPercentage,
        pickingPeriod: doc.picking_period ?? null,
        pickingStartDate: doc.picking_start_date ?? null,
        pickingEndDate: doc.picking_end_date ?? null,
        sortOrder:
          typeof doc.sort_order === 'number' && Number.isInteger(doc.sort_order)
            ? doc.sort_order
            : 999,
      },
      create: {
        name,
        slug,
        imageUrl: doc.image_url ?? null,
        description: doc.description ?? null,
        yieldPercentage,
        pickingPeriod: doc.picking_period ?? null,
        pickingStartDate: doc.picking_start_date ?? null,
        pickingEndDate: doc.picking_end_date ?? null,
        sortOrder:
          typeof doc.sort_order === 'number' && Number.isInteger(doc.sort_order)
            ? doc.sort_order
            : 999,
      },
    });

    console.log(`   ✅ 品类 ${name} (legacy _id=${legacyId})`);
  }
}

const migrateCategories = migrateTeaCategories;

async function migrateSettings(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移设置 (settings)...');
  const docs = (await db.collection('settings').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const key: string = doc.key;
    if (!key) {
      console.warn('   ⚠️ 跳过缺少 key 的设置项');
      continue;
    }

    const normalizedCategory = normalizeSettingCategory(doc.category);
    const normalizedDataType = normalizeSettingDataType(doc.data_type);
    const rawValue = doc.value;
    const value =
      typeof rawValue === 'string'
        ? rawValue
        : rawValue === null || rawValue === undefined
          ? null
          : JSON.stringify(rawValue);

    await client.setting.upsert({
      where: { key },
      update: {
        value,
        description: doc.description ?? null,
        category: normalizedCategory,
        dataType: normalizedDataType,
        isPublic: typeof doc.is_public === 'boolean' ? doc.is_public : false,
      },
      create: {
        key,
        value,
        description: doc.description ?? null,
        category: normalizedCategory,
        dataType: normalizedDataType,
        isPublic: typeof doc.is_public === 'boolean' ? doc.is_public : false,
      },
    });

    console.log(`   ✅ 设置 ${key}`);
  }
}

async function migratePlots(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移地块 (plots)...');
  const docs = (await db.collection('plots').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const name: string | undefined = doc.name;
    if (!name) {
      console.warn(`   ⚠️ 跳过无效地块 _id=${legacyId}`);
      continue;
    }

    const carouselImages: string[] = Array.isArray(doc.carousel_images)
      ? doc.carousel_images
      : [];
    const infoList = doc.info_list ?? [];

    const plot = await client.plot.upsert({
      where: { name },
      update: { carouselImages, infoList },
      create: { name, carouselImages, infoList },
    });

    if (legacyId) {
      legacyPlotIdToNewId.set(legacyId, plot.id);
    }

    console.log(
      `   ✅ 地块 ${name} (legacy _id=${legacyId}, new id=${plot.id})`,
    );
  }
}

async function migrateProductionStepTemplates(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移制作步骤模板 (production_step_templates)...');
  const docs = (await db
    .collection('production_step_templates')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  const validSteps = ['摊晾', '杀青', '揉捻', '干燥', '分拣'];

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const stepName: string = doc.step_name;
    if (!stepName || !validSteps.includes(stepName)) {
      console.warn(
        `   ⚠️ 跳过无效步骤 _id=${legacyId}, step_name=${stepName}`,
      );
      continue;
    }

    await client.productionStepTemplate.upsert({
      where: { stepName },
      update: {
        manualCraft:
          doc.manual_craft ??
          ({ purpose: '', method: '', sensory_change: '', value: '' } as any),
        modernCraft:
          doc.modern_craft ??
          ({ purpose: '', method: '', sensory_change: '', value: '' } as any),
      },
      create: {
        stepName,
        manualCraft:
          doc.manual_craft ??
          ({ purpose: '', method: '', sensory_change: '', value: '' } as any),
        modernCraft:
          doc.modern_craft ??
          ({ purpose: '', method: '', sensory_change: '', value: '' } as any),
      },
    });

    console.log(`   ✅ 步骤模板 ${stepName} (legacy _id=${legacyId})`);
  }
}

const migrateStepTemplates = migrateProductionStepTemplates;

async function migrateTitleTemplates(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移标题模板 (title_templates)...');
  const docs = (await db.collection('title_templates').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const categoryName: string = doc.category_name;
    const titleTemplate: string = doc.title_template;
    if (!categoryName || !titleTemplate) {
      console.warn(`   ⚠️ 跳过无效标题模板 _id=${legacyId}`);
      continue;
    }

    await client.titleTemplate.upsert({
      where: { categoryName },
      update: { titleTemplate },
      create: { categoryName, titleTemplate },
    });

    console.log(
      `   ✅ 标题模板 ${categoryName} (legacy _id=${legacyId})`,
    );
  }
}

async function migrateAppreciationTemplates(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移鉴赏模板 (appreciation_templates)...');
  const docs = (await db
    .collection('appreciation_templates')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const categoryName: string = doc.category_name;
    if (!categoryName) {
      console.warn(`   ⚠️ 跳过无效鉴赏模板 _id=${legacyId}`);
      continue;
    }

    await client.appreciationTemplate.upsert({
      where: { categoryName },
      update: {
        tastingNotes: doc.tasting_notes ?? '',
        brewingSuggestion: doc.brewing_suggestion ?? '',
        storageMethod: doc.storage_method ?? '',
      },
      create: {
        categoryName,
        tastingNotes: doc.tasting_notes ?? '',
        brewingSuggestion: doc.brewing_suggestion ?? '',
        storageMethod: doc.storage_method ?? '',
      },
    });

    console.log(
      `   ✅ 鉴赏模板 ${categoryName} (legacy _id=${legacyId})`,
    );
  }
}

async function migrateWeatherTemplates(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移天气模板 (weather_templates)...');
  const docs = (await db.collection('weather_templates').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const name: string = doc.name;
    if (!name) {
      console.warn(`   ⚠️ 跳过无效天气模板 _id=${legacyId}`);
      continue;
    }

    await client.weatherTemplate.upsert({
      where: { name },
      update: {
        svgIcon: doc.svg_icon ?? '',
        temperatureRange: doc.temperature_range ?? '',
        description: doc.description ?? '',
        sortOrder: typeof doc.sort_order === 'number' ? doc.sort_order : 0,
        isActive:
          typeof doc.is_active === 'boolean' ? doc.is_active : true,
      },
      create: {
        name,
        svgIcon: doc.svg_icon ?? '',
        temperatureRange: doc.temperature_range ?? '',
        description: doc.description ?? '',
        sortOrder: typeof doc.sort_order === 'number' ? doc.sort_order : 0,
        isActive:
          typeof doc.is_active === 'boolean' ? doc.is_active : true,
      },
    });

    console.log(`   ✅ 天气模板 ${name} (legacy _id=${legacyId})`);
  }
}

async function migratePersonnel(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移人员 (personnel)...');
  console.log('🧹 [Personnel] 正在清空 PostgreSQL 中的旧人员数据...');
  await client.personnel.deleteMany({});
  console.log('✅ [Personnel] 旧数据已清空，准备重新迁移...');
  const docs = (await db.collection('personnel').find().toArray()) as any[];
  console.log(`[Personnel] 1. 从 MongoDB 查找到 ${docs.length} 条人员数据。`);

  const roleMap: Record<string, PersonnelRole> = {
    记录人: PersonnelRole.RECORDER,
    采摘队长: PersonnelRole.HARVEST_LEAD,
    制茶师: PersonnelRole.TEA_MASTER,
  };

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const deterministicId = legacyIdToUuid(legacyId);
    if (!deterministicId) {
      console.warn(`   ⚠️ 跳过无法生成 UUID 的人员 _id=${legacyId}`);
      continue;
    }
    const name: string = doc.name;
    const roleStr: string = doc.role;
    if (!name || !roleStr) {
      console.warn(`   ⚠️ 跳过无效人员 _id=${legacyId}`);
      continue;
    }

    const mappedRole = roleMap[roleStr];
    if (!mappedRole) {
      console.warn(`   ⚠️ 未知角色 _id=${legacyId}, role=${roleStr}`);
      continue;
    }

    const expRaw =
      typeof doc.experience_years === 'number' ? doc.experience_years : 0;
    const experienceYears = Math.min(
      Math.max(Math.round(expRaw), 0),
      100,
    );
    const person = await client.personnel.upsert({
      where: { id: deterministicId },
      update: {
        avatarUrl: doc.avatar_url ?? '',
        experienceYears,
      },
      create: {
        id: deterministicId,
        name,
        role: mappedRole,
        avatarUrl: doc.avatar_url ?? '',
        experienceYears,
      },
    });

    if (legacyId) {
      legacyPersonnelIdToNewId.set(legacyId, person.id);
    }

    console.log(
      `   ✅ 人员 ${name} (${roleStr} -> ${mappedRole}) legacy _id=${legacyId}, new id=${person.id}`,
    );
  }
}

async function migrateGrades(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移等级 (grades)...');
  console.log('🧹 [Grades] 正在清空 PostgreSQL 中的旧等级数据...');
  await client.grade.deleteMany({});
  console.log('✅ [Grades] 旧数据已清空，准备重新迁移...');
  const docs = (await db.collection('grades').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const name: string = doc.name;
    if (!name) {
      console.warn(`   ⚠️ 跳过无效等级 _id=${legacyId}`);
      continue;
    }

    await client.grade.upsert({
      where: { name },
      update: { badgeUrl: doc.badge_url ?? '' },
      create: { name, badgeUrl: doc.badge_url ?? '' },
    });

    console.log(`   ✅ 等级 ${name} (legacy _id=${legacyId})`);
  }
}

async function migrateAdoptionPlans(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移领养方案 (adoption_plans)...');
  const docs = (await db
    .collection('adoption_plans')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  const typeMap: Record<string, AdoptionPlanType> = {
    private: AdoptionPlanType.PRIVATE,
    enterprise: AdoptionPlanType.ENTERPRISE,
    b2b: AdoptionPlanType.B2B,
  };

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const typeStr: string = doc.type;
    const mappedType = typeMap[typeStr];
    if (!mappedType) {
      console.warn(`   ⚠️ 跳过未知类型领养方案 _id=${legacyId}, type=${typeStr}`);
      continue;
    }

    await client.adoptionPlan.upsert({
      where: { type: mappedType },
      update: {
        marketingHeader: doc.marketing_header ?? null,
        valuePropositions: doc.value_propositions ?? null,
        customerCases: doc.customer_cases ?? null,
        scenarioApplications: doc.scenario_applications ?? null,
        packages: doc.packages ?? null,
        comparisonPackageNames: doc.comparison_package_names ?? null,
        comparisonFeatures: doc.comparison_features ?? null,
        processSteps: doc.process_steps ?? null,
        useScenarios: doc.use_scenarios ?? null,
        serviceContents: doc.service_contents ?? null,
        description: doc.description ?? null,
      },
      create: {
        type: mappedType,
        marketingHeader: doc.marketing_header ?? null,
        valuePropositions: doc.value_propositions ?? null,
        customerCases: doc.customer_cases ?? null,
        scenarioApplications: doc.scenario_applications ?? null,
        packages: doc.packages ?? null,
        comparisonPackageNames: doc.comparison_package_names ?? null,
        comparisonFeatures: doc.comparison_features ?? null,
        processSteps: doc.process_steps ?? null,
        useScenarios: doc.use_scenarios ?? null,
        serviceContents: doc.service_contents ?? null,
        description: doc.description ?? null,
      },
    });

    console.log(
      `   ✅ 领养方案 ${typeStr} (legacy _id=${legacyId}, type=${mappedType})`,
    );
  }
}

function mapFarmActivityType(raw: string | undefined): FarmActivityType {
  switch (raw) {
    case '施肥':
      return FarmActivityType.FERTILIZE;
    case '修剪':
      return FarmActivityType.PRUNE;
    case '灌溉':
      return FarmActivityType.IRRIGATE;
    case '采摘':
      return FarmActivityType.HARVEST;
    case '异常':
      return FarmActivityType.ABNORMAL;
    default:
      return FarmActivityType.NONE;
  }
}

async function migrateDailyGrowthLogs(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移每日生长日志 (daily_growth_logs)...');
  const docs = (await db
    .collection('daily_growth_logs')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const date: Date | undefined = doc.date;
    if (!date) {
      console.warn(`   ⚠️ 跳过缺少日期的生长日志 _id=${legacyId}`);
      continue;
    }

    const legacyPlotId = toLegacyId(doc.plot_id);
    const plotId = legacyPlotId
      ? legacyPlotIdToNewId.get(legacyPlotId) ?? null
      : null;

    const legacyRecorderId = toLegacyId(doc.recorder_id);
    const recorderId = legacyRecorderId
      ? legacyPersonnelIdToNewId.get(legacyRecorderId) ?? null
      : null;

    await client.dailyGrowthLog.upsert({
      where: { date },
      update: {
        plotId,
        recorderName: doc.recorder_name ?? null,
        recorderId,
        mainImageUrl: doc.main_image_url ?? null,
        statusTag: doc.status_tag ?? null,
        weather: doc.weather ?? null,
        summary: doc.summary ?? null,
        detailGallery: doc.detail_gallery ?? null,
        photoInfo: doc.photo_info ?? null,
        environmentData: doc.environment_data ?? null,
        fullLog: doc.full_log ?? null,
        farmActivityType: mapFarmActivityType(doc.farm_activity_type),
        farmActivityLog: doc.farm_activity_log ?? null,
        phenologicalObservation: doc.phenological_observation ?? null,
        abnormalEvent: doc.abnormal_event ?? null,
        harvestWeightKg:
          typeof doc.harvest_weight_kg === 'number'
            ? doc.harvest_weight_kg
            : 0,
      },
      create: {
        date,
        plotId,
        recorderName: doc.recorder_name ?? null,
        recorderId,
        mainImageUrl: doc.main_image_url ?? null,
        statusTag: doc.status_tag ?? null,
        weather: doc.weather ?? null,
        summary: doc.summary ?? null,
        detailGallery: doc.detail_gallery ?? null,
        photoInfo: doc.photo_info ?? null,
        environmentData: doc.environment_data ?? null,
        fullLog: doc.full_log ?? null,
        farmActivityType: mapFarmActivityType(doc.farm_activity_type),
        farmActivityLog: doc.farm_activity_log ?? null,
        phenologicalObservation: doc.phenological_observation ?? null,
        abnormalEvent: doc.abnormal_event ?? null,
        harvestWeightKg:
          typeof doc.harvest_weight_kg === 'number'
            ? doc.harvest_weight_kg
            : 0,
      },
    });

    console.log(
      `   ✅ 生长日志 ${date.toISOString().slice(0, 10)} (legacy _id=${legacyId})`,
    );
  }
}

async function migrateMonthlySummaries(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移月度汇总 (monthly_summaries)...');
  const docs = (await db
    .collection('monthly_summaries')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const yearMonth: string | undefined = doc.year_month;
    if (!yearMonth) {
      console.warn(`   ⚠️ 跳过无效月度汇总 _id=${legacyId}`);
      continue;
    }

    const legacyPlotId = toLegacyId(doc.plot_id);
    const plotId = legacyPlotId
      ? legacyPlotIdToNewId.get(legacyPlotId) ?? null
      : null;

    await client.monthlySummary.upsert({
      where: { yearMonth },
      update: {
        plotId,
        detailGallery: doc.detail_gallery ?? null,
        harvestStats: doc.harvest_stats ?? null,
        farmCalendar: doc.farm_calendar ?? null,
        abnormalSummary: doc.abnormal_summary ?? null,
        climateSummary: doc.climate_summary ?? null,
        nextMonthPlan: doc.next_month_plan ?? null,
      },
      create: {
        yearMonth,
        plotId,
        detailGallery: doc.detail_gallery ?? null,
        harvestStats: doc.harvest_stats ?? null,
        farmCalendar: doc.farm_calendar ?? null,
        abnormalSummary: doc.abnormal_summary ?? null,
        climateSummary: doc.climate_summary ?? null,
        nextMonthPlan: doc.next_month_plan ?? null,
      },
    });

    console.log(`   ✅ 月度汇总 ${yearMonth} (legacy _id=${legacyId})`);
  }
}

function mapBatchStatus(raw: string | undefined): BatchStatus {
  switch (raw) {
    case '进行中':
      return BatchStatus.IN_PROGRESS;
    case '已完成':
      return BatchStatus.COMPLETED;
    case '已发布':
    default:
      return BatchStatus.PUBLISHED;
  }
}

async function migrateBatches(db: Db, client: PrismaClient = prisma) {
  console.log('➡️ 迁移制作批次 (batches)...');
  const docs = (await db.collection('batches').find().toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const batchNumber: string | undefined = doc.batch_number;
    const categoryName: string | undefined = doc.category_name;
    if (!batchNumber || !categoryName) {
      console.warn(`   ⚠️ 跳过无效批次 _id=${legacyId}`);
      continue;
    }

    const legacyTeaMasterId = toLegacyId(doc.tea_master_id);
    const teaMasterId = legacyTeaMasterId
      ? legacyPersonnelIdToNewId.get(legacyTeaMasterId) ?? null
      : null;

    const gradeName: string | undefined = doc.grade;
    let gradeId: string | null = null;
    if (gradeName) {
      const grade = await client.grade.findUnique({
        where: { name: gradeName },
      });
      gradeId = grade?.id ?? null;
    }

    const batch = await client.batch.upsert({
      where: { batchNumber },
      update: {
        categoryName,
        teaMaster: doc.tea_master ?? null,
        teaMasterId,
        productionSteps: doc.production_steps ?? null,
        tastingReport: doc.tasting_report ?? null,
        productAppreciation: doc.product_appreciation ?? null,
        finalProductWeightKg:
          typeof doc.final_product_weight_kg === 'number'
            ? doc.final_product_weight_kg
            : null,
        grade: gradeName ?? null,
        gradeId,
        productionDate: doc.production_date ?? null,
        status: mapBatchStatus(doc.status),
        coverImageUrl: doc.cover_image_url ?? null,
        detailCoverImageUrl: doc.detail_cover_image_url ?? null,
        imagesAndVideos: doc.images_and_videos ?? null,
        notes: doc.notes ?? null,
        detailTitle: doc.detail_title ?? null,
      },
      create: {
        batchNumber,
        categoryName,
        teaMaster: doc.tea_master ?? null,
        teaMasterId,
        productionSteps: doc.production_steps ?? null,
        tastingReport: doc.tasting_report ?? null,
        productAppreciation: doc.product_appreciation ?? null,
        finalProductWeightKg:
          typeof doc.final_product_weight_kg === 'number'
            ? doc.final_product_weight_kg
            : null,
        grade: gradeName ?? null,
        gradeId,
        productionDate: doc.production_date ?? null,
        status: mapBatchStatus(doc.status),
        coverImageUrl: doc.cover_image_url ?? null,
        detailCoverImageUrl: doc.detail_cover_image_url ?? null,
        imagesAndVideos: doc.images_and_videos ?? null,
        notes: doc.notes ?? null,
        detailTitle: doc.detail_title ?? null,
      },
    });

    if (legacyId) {
      legacyBatchIdToNewId.set(legacyId, batch.id);
    }

    console.log(
      `   ✅ 批次 ${batchNumber} (legacy _id=${legacyId}, new id=${batch.id})`,
    );
  }
}

async function migrateHarvestRecords(
  db: Db,
  client: PrismaClient = prisma,
) {
  console.log('➡️ 迁移采摘记录 (harvest_records)...');
  console.log('🧹 [HarvestRecords] 正在清空 PostgreSQL 中的旧采摘记录...');
  console.log('   - 先清空关联表 batch_harvest_records...');
  await client.batchHarvestRecord.deleteMany({});
  console.log('   - 关联表已清空，继续清空 harvest_records...');
  await client.harvestRecord.deleteMany({});
  console.log('✅ [HarvestRecords] 旧采摘记录已清空，准备重新迁移...');
  const docs = (await db
    .collection('harvest_records')
    .find()
    .toArray()) as any[];
  console.log(`   共 ${docs.length} 条`);

  for (const doc of docs) {
    const legacyId = toLegacyId(doc._id);
    const deterministicId = legacyIdToUuid(legacyId);
    if (!deterministicId) {
      console.warn(`   ⚠️ 跳过无法生成 UUID 的采摘记录 _id=${legacyId}`);
      continue;
    }

    // 严格处理日期字段：从多个可能的字段名中查找，并确保转换为有效的 Date 对象
    const harvestDateRaw: Date | string | undefined =
      doc.harvest_date ??
      doc.harvestDate ??
      doc.date ??
      doc.harvested_at ??
      doc.created_at ??
      null;

    let harvestDate: Date | null = null;
    if (harvestDateRaw) {
      if (harvestDateRaw instanceof Date) {
        harvestDate = harvestDateRaw;
      } else if (typeof harvestDateRaw === 'string') {
        const parsed = new Date(harvestDateRaw);
        if (!Number.isNaN(parsed.getTime())) {
          harvestDate = parsed;
        }
      }
    }

    if (!harvestDate || Number.isNaN(harvestDate.getTime())) {
      console.warn(
        `   ⚠️ 跳过无效采摘记录 _id=${legacyId}, harvest_date=${harvestDateRaw}`,
      );
      continue;
    }

    const legacyTeamId = toLegacyId(doc.harvest_team_id);
    const harvestTeamId = legacyTeamId
      ? legacyPersonnelIdToNewId.get(legacyTeamId) ?? null
      : null;

    const legacyBatchId = toLegacyId(doc.assigned_batch_id);
    const assignedBatchId = legacyBatchId
      ? legacyBatchIdToNewId.get(legacyBatchId) ?? null
      : null;

    let categoryId: string | null = null;
    const categoryName: string | undefined = doc.category_name;
    if (categoryName) {
      const category = await client.teaCategory.findUnique({
        where: { name: categoryName },
      });
      categoryId = category?.id ?? null;
    }

    // 严格处理重量字段：从多个可能的字段名中查找，确保转换为有效的数字
    const totalWeightSource =
      typeof doc.fresh_leaf_weight_kg === 'number'
        ? doc.fresh_leaf_weight_kg
        : typeof doc.total_weight === 'number'
          ? doc.total_weight
          : typeof doc.total_weight_kg === 'number'
            ? doc.total_weight_kg
            : typeof doc.weight === 'number'
              ? doc.weight
              : typeof doc.totalWeight === 'number'
                ? doc.totalWeight
                : typeof doc.totalWeightKg === 'number'
                  ? doc.totalWeightKg
                  : typeof doc.freshLeafWeightKg === 'number'
                    ? doc.freshLeafWeightKg
                    : null;

    // 确保重量是有效的数字，如果无效则使用 0
    let freshLeafWeightKg = 0;
    if (totalWeightSource !== null && totalWeightSource !== undefined) {
      const parsed = Number(totalWeightSource);
      if (Number.isFinite(parsed) && parsed >= 0) {
        freshLeafWeightKg = parsed;
      }
    }

    const record = await client.harvestRecord.upsert({
      where: { id: deterministicId },
      update: {
        harvestDate,
        freshLeafWeightKg,
        weather: doc.weather ?? null,
        imagesAndVideos: doc.images_and_videos ?? null,
        mediaUrls: doc.media_urls ?? null,
        harvestTeam: doc.harvest_team ?? null,
        harvestTeamId,
        assignedBatchId,
        categoryId,
        categoryName: categoryName ?? null,
        notes: doc.notes ?? null,
      },
      create: {
        id: deterministicId,
        harvestDate,
        freshLeafWeightKg,
        weather: doc.weather ?? null,
        imagesAndVideos: doc.images_and_videos ?? null,
        mediaUrls: doc.media_urls ?? null,
        harvestTeam: doc.harvest_team ?? null,
        harvestTeamId,
        assignedBatchId,
        categoryId,
        categoryName: categoryName ?? null,
        notes: doc.notes ?? null,
      },
    });

    if (assignedBatchId) {
      await client.batchHarvestRecord.upsert({
        where: {
          batchId_harvestRecordId: {
            batchId: assignedBatchId,
            harvestRecordId: record.id,
          },
        },
        update: {},
        create: {
          batchId: assignedBatchId,
          harvestRecordId: record.id,
          notes: null,
        },
      });
    }

    console.log(
      `   ✅ 采摘记录 ${harvestDate.toISOString().slice(0, 10)} - ${freshLeafWeightKg}kg (legacy _id=${legacyId}, new id=${record.id})`,
    );
  }
}

async function main() {
  console.log('🚀 开始执行全量数据迁移脚本...');
  const { client, db } = await connectOldMongo();

  try {
    await migrateUsers(db, prisma);
    await migratePersonnel(db, prisma);
    await migrateGrades(db, prisma);
    await migrateStepTemplates(db, prisma);
    await migrateTitleTemplates(db, prisma);
    await migrateAppreciationTemplates(db, prisma);
    await migrateWeatherTemplates(db, prisma);
    await migratePlots(db, prisma);
    await migrateCategories(db, prisma);
    await migrateSettings(db, prisma);

    await migrateAdoptionPlans(db, prisma);
    await migrateDailyGrowthLogs(db, prisma);
    await migrateMonthlySummaries(db, prisma);
    await migrateBatches(db, prisma);
    await migrateHarvestRecords(db, prisma);

    console.log('🎉 所有核心模块数据迁移完成！');
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await client.close();
    console.log('🔚 已关闭 Prisma 与 MongoDB 连接');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ 脚本执行失败:', err);
    process.exit(1);
  });
}


