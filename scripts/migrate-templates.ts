import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import { PrismaClient, PersonnelRole, AdoptionPlanType } from '@prisma/client';

const OLD_MONGO_URL = process.env.OLD_MONGO_URL;

if (!OLD_MONGO_URL) {
  throw new Error('环境变量 OLD_MONGO_URL 未配置，请在项目根目录 .env 中添加 OLD_MONGO_URL="mongodb://..."');
}

const prisma = new PrismaClient();

type MongoConnection = {
  client: MongoClient;
  db: Db;
};

async function connectOldMongo(): Promise<MongoConnection> {
  const client = new MongoClient(OLD_MONGO_URL!);
  await client.connect();
  const db = client.db(); // 若 URI 中指定了库名，这里会自动使用；否则使用默认库
  console.log(`✅ 已连接旧 MongoDB 数据库: ${db.databaseName}`);
  return { client, db };
}

// ======================
// 各模板集合迁移函数
// ======================

async function migrateProductionStepTemplates(db: Db) {
  console.log('➡️ 开始迁移制作步骤模板 (collection: production_step_templates)...');

  const col = db.collection('production_step_templates');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条制作步骤模板`);

  const validSteps = ['摊晾', '杀青', '揉捻', '干燥', '分拣'];

  for (const doc of docs) {
    const stepName: string = doc.step_name;
    if (!stepName || !validSteps.includes(stepName)) {
      console.warn(`   ⚠️ 跳过无效步骤名称文档 _id=${doc._id}: step_name=${stepName}`);
      continue;
    }

    await prisma.productionStepTemplate.upsert({
      where: { stepName },
      update: {
        manualCraft: doc.manual_craft ?? { purpose: '', method: '', sensory_change: '', value: '' },
        modernCraft: doc.modern_craft ?? { purpose: '', method: '', sensory_change: '', value: '' },
      },
      create: {
        stepName,
        manualCraft: doc.manual_craft ?? { purpose: '', method: '', sensory_change: '', value: '' },
        modernCraft: doc.modern_craft ?? { purpose: '', method: '', sensory_change: '', value: '' },
      },
    });

    console.log(`   ✅ 已迁移制作步骤模板: ${stepName}`);
  }
}

async function migrateTitleTemplates(db: Db) {
  console.log('➡️ 开始迁移批次详情标题模板 (collection: title_templates)...');

  const col = db.collection('title_templates');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条标题模板`);

  for (const doc of docs) {
    const categoryName: string = doc.category_name;
    const titleTemplate: string = doc.title_template;

    if (!categoryName || !titleTemplate) {
      console.warn(`   ⚠️ 跳过缺少必要字段的标题模板文档 _id=${doc._id}`);
      continue;
    }

    await prisma.titleTemplate.upsert({
      where: { categoryName },
      update: {
        titleTemplate,
      },
      create: {
        categoryName,
        titleTemplate,
      },
    });

    console.log(`   ✅ 已迁移标题模板: ${categoryName}`);
  }
}

async function migrateAppreciationTemplates(db: Db) {
  console.log('➡️ 开始迁移鉴赏模板 (collection: appreciation_templates)...');

  const col = db.collection('appreciation_templates');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条鉴赏模板`);

  for (const doc of docs) {
    const categoryName: string = doc.category_name;
    if (!categoryName) {
      console.warn(`   ⚠️ 跳过缺少 category_name 的鉴赏模板文档 _id=${doc._id}`);
      continue;
    }

    await prisma.appreciationTemplate.upsert({
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

    console.log(`   ✅ 已迁移鉴赏模板: ${categoryName}`);
  }
}

async function migrateWeatherTemplates(db: Db) {
  console.log('➡️ 开始迁移天气模板 (collection: weather_templates)...');

  const col = db.collection('weather_templates');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条天气模板`);

  for (const doc of docs) {
    const name: string = doc.name;
    if (!name) {
      console.warn(`   ⚠️ 跳过缺少 name 的天气模板文档 _id=${doc._id}`);
      continue;
    }

    await prisma.weatherTemplate.upsert({
      where: { name },
      update: {
        svgIcon: doc.svg_icon ?? '',
        temperatureRange: doc.temperature_range ?? '',
        description: doc.description ?? '',
        sortOrder: typeof doc.sort_order === 'number' ? doc.sort_order : 0,
        isActive: typeof doc.is_active === 'boolean' ? doc.is_active : true,
      },
      create: {
        name,
        svgIcon: doc.svg_icon ?? '',
        temperatureRange: doc.temperature_range ?? '',
        description: doc.description ?? '',
        sortOrder: typeof doc.sort_order === 'number' ? doc.sort_order : 0,
        isActive: typeof doc.is_active === 'boolean' ? doc.is_active : true,
      },
    });

    console.log(`   ✅ 已迁移天气模板: ${name}`);
  }
}

async function migratePersonnel(db: Db) {
  console.log('➡️ 开始迁移人员模板 (collection: personnel)...');

  const col = db.collection('personnel');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条人员记录`);

  const roleMap: Record<string, PersonnelRole> = {
    记录人: PersonnelRole.RECORDER,
    采摘队长: PersonnelRole.HARVEST_LEAD,
    制茶师: PersonnelRole.TEA_MASTER,
  };

  for (const doc of docs) {
    const name: string = doc.name;
    const roleStr: string = doc.role;

    if (!name || !roleStr) {
      console.warn(`   ⚠️ 跳过缺少 name/role 的人员文档 _id=${doc._id}`);
      continue;
    }

    const mappedRole = roleMap[roleStr];
    if (!mappedRole) {
      console.warn(`   ⚠️ 跳过未知角色的人员文档 _id=${doc._id}, role=${roleStr}`);
      continue;
    }

    const experienceYearsRaw = typeof doc.experience_years === 'number' ? doc.experience_years : 0;
    const experienceYears = Math.min(Math.max(Math.round(experienceYearsRaw), 0), 100);

    // 以 (role, name) 作为唯一键进行 upsert
    await prisma.personnel.upsert({
      where: {
        role_name: {
          role: mappedRole,
          name,
        },
      },
      update: {
        avatarUrl: doc.avatar_url ?? '',
        experienceYears,
      },
      create: {
        name,
        role: mappedRole,
        avatarUrl: doc.avatar_url ?? '',
        experienceYears,
      },
    });

    console.log(`   ✅ 已迁移人员: ${name} (${roleStr} -> ${mappedRole})`);
  }
}

async function migrateGrades(db: Db) {
  console.log('➡️ 开始迁移等级模板 (collection: grades)...');

  const col = db.collection('grades');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条等级记录`);

  for (const doc of docs) {
    const name: string = doc.name;
    if (!name) {
      console.warn(`   ⚠️ 跳过缺少 name 的等级文档 _id=${doc._id}`);
      continue;
    }

    await prisma.grade.upsert({
      where: { name },
      update: {
        badgeUrl: doc.badge_url ?? '',
      },
      create: {
        name,
        badgeUrl: doc.badge_url ?? '',
      },
    });

    console.log(`   ✅ 已迁移等级: ${name}`);
  }
}

async function migrateAdoptionPlans(db: Db) {
  console.log('➡️ 开始迁移云养茶园领养方案 (collection: adoption_plans)...');

  const col = db.collection('adoption_plans');
  const docs = await col.find().toArray();

  console.log(`   读取到 ${docs.length} 条领养方案记录`);

  const typeMap: Record<string, AdoptionPlanType> = {
    private: AdoptionPlanType.PRIVATE,
    enterprise: AdoptionPlanType.ENTERPRISE,
    b2b: AdoptionPlanType.B2B,
  };

  for (const doc of docs) {
    const typeStr: string = doc.type;
    const mappedType = typeMap[typeStr];

    if (!mappedType) {
      console.warn(`   ⚠️ 跳过未知 type 的领养方案文档 _id=${doc._id}, type=${typeStr}`);
      continue;
    }

    await prisma.adoptionPlan.upsert({
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

    console.log(`   ✅ 已迁移领养方案: ${typeStr} -> ${mappedType}`);
  }
}

// ======================
// 主入口
// ======================

async function main() {
  console.log('🚀 开始执行模板中心数据迁移脚本...');

  const { client, db } = await connectOldMongo();

  try {
    await migrateProductionStepTemplates(db);
    await migrateTitleTemplates(db);
    await migrateAppreciationTemplates(db);
    await migrateWeatherTemplates(db);
    await migratePersonnel(db);
    await migrateGrades(db);
    await migrateAdoptionPlans(db);

    console.log('🎉 模板中心相关数据迁移完成！');
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await client.close();
    console.log('🔚 已关闭 Prisma 与 MongoDB 连接');
  }
}

// 直接运行该脚本时执行
main().catch((err) => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});


