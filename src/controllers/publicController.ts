import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { BatchStatus } from '@prisma/client';

/**
 * 辅助函数：为生长日志关联采摘记录信息（与growthController中的相同）
 */
async function enrichLogsWithHarvestInfo(logs: any[]) {
  if (!logs || logs.length === 0) {
    return logs;
  }

  const dates = logs.map((log) => new Date(log.date).toISOString().split('T')[0]);

  const harvestRecords = await prisma.harvestRecord.findMany({
    where: {
      harvestDate: {
        in: dates.map((d) => new Date(d)),
      },
    },
    select: {
      harvestDate: true,
      freshLeafWeightKg: true,
      categoryName: true,
    },
  });

  const harvestMap = new Map();
  harvestRecords.forEach((record) => {
    const dateKey = new Date(record.harvestDate).toISOString().split('T')[0];
    if (!harvestMap.has(dateKey)) {
      harvestMap.set(dateKey, []);
    }
    harvestMap.get(dateKey).push({
      weight: Number(record.freshLeafWeightKg),
      category: record.categoryName,
    });
  });

  return logs.map((log) => {
    const dateKey = new Date(log.date).toISOString().split('T')[0];
    const harvests = harvestMap.get(dateKey) || [];
    const totalWeight = harvests.reduce((sum: number, h: any) => sum + h.weight, 0);

    return {
      ...log,
      harvest_info: {
        has_harvest: harvests.length > 0,
        count: harvests.length,
        total_weight_kg: totalWeight,
        categories: [...new Set(harvests.map((h: any) => h.category).filter(Boolean))],
      },
    };
  });
}

/**
 * 获取生长过程数据
 * GET /api/public/growth-data
 */
export async function getPublicGrowthData(req: Request, res: Response) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供月份参数 (month)，格式为 YYYY-MM',
      });
    }

    // 验证月份格式
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '月份格式不正确，应为 YYYY-MM，例如：2025-08',
      });
    }

    // 1. 获取该月份的每日生长日志
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    let dailyLogsData = await prisma.dailyGrowthLog.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        recorder: {
          select: {
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // 关联采摘记录信息
    const dailyLogsWithHarvest = await enrichLogsWithHarvestInfo(dailyLogsData);

    // 2. 获取该月份的月度汇总
    const monthlySummary = await prisma.monthlySummary.findUnique({
      where: {
        yearMonth: month,
      },
    });

    // 3. 将所有数据整合成一个对象
    const growthData = {
      month: month,
      dailyLogs: dailyLogsWithHarvest,
      monthlySummary: monthlySummary,
      dailyLogsCount: dailyLogsWithHarvest.length,
      hasMonthlySummary: monthlySummary !== null,
    };

    console.log(`✅ 公开生长过程数据已发送 [${month}]（已关联采摘信息）`);
    console.log(`   - 每日日志: ${dailyLogsWithHarvest.length} 条`);
    console.log(`   - 月度汇总: ${monthlySummary ? '已有' : '无'}`);

    res.status(200).json(growthData);
  } catch (error) {
    console.error('获取公开生长过程数据时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取数据时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取月度汇总报告
 * GET /api/public/monthly-summary
 */
export async function getPublicMonthlySummary(req: Request, res: Response) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供月份参数 (month)，格式为 YYYY-MM',
      });
    }

    // 验证月份格式
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '月份格式不正确，应为 YYYY-MM，例如：2025-10',
      });
    }

    // 查询该月份的月度汇总
    const summary = await prisma.monthlySummary.findUnique({
      where: {
        yearMonth: month,
      },
    });

    // 构建返回数据
    const summaryData = {
      month: month,
      summary: summary,
      hasSummary: summary !== null,
    };

    console.log(`✅ 公开月度汇总已发送 [${month}]`);
    console.log(`   - 月度汇总: ${summary ? '已有' : '无'}`);

    res.status(200).json(summaryData);
  } catch (error) {
    console.error('获取公开月度汇总时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取数据时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取所有可用的品类列表
 * GET /api/public/categories
 */
export async function getPublicCategories(req: Request, res: Response) {
  try {
    console.log('📋 [API] 获取品类列表请求');

    // 1. 获取所有品类（按 sort_order 排序）
    const allCategories = await prisma.teaCategory.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // 2. 统计每个品类的已发布批次数量
    const categoriesWithCount = await Promise.all(
      allCategories.map(async (category) => {
        const count = await prisma.batch.count({
          where: {
            categoryName: category.name,
            status: BatchStatus.PUBLISHED,
          },
        });
        return {
          name: category.name,
          slug: category.slug,
          count: count,
          sort_order: category.sortOrder || 999,
        };
      }),
    );

    // 3. 过滤掉批次数量为0的品类，并按 sort_order 排序
    const categories = categoriesWithCount
      .filter((cat) => cat.count > 0)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ name, slug, count }) => ({ name, slug, count }));

    console.log(`✅ [API] 成功获取 ${categories.length} 个品类（按 sort_order 排序）`);

    // 返回品类数组（简单格式，与现有批次接口保持一致）
    res.json(categories);
  } catch (error) {
    console.error('❌ [API] 获取品类列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品类列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取所有启用的天气模板
 * GET /api/public/weather-templates
 */
export async function getPublicWeatherTemplates(req: Request, res: Response) {
  try {
    // 获取所有启用的天气模板
    const weatherTemplates = await prisma.weatherTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // 构建名称到SVG图标的映射
    const weatherIconMap: Record<string, string> = {};
    weatherTemplates.forEach((template) => {
      weatherIconMap[template.name] = template.svgIcon;
    });

    console.log(`✅ 公开天气模板已发送，共 ${weatherTemplates.length} 个模板`);

    res.status(200).json({
      success: true,
      data: {
        templates: weatherTemplates,
        iconMap: weatherIconMap,
      },
      count: weatherTemplates.length,
    });
  } catch (error) {
    console.error('获取天气模板时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取天气模板时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

async function findCategoryBySlug(slug: string) {
  if (!slug) {
    return null;
  }

  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return null;
  }

  return prisma.teaCategory.findFirst({
    where: {
      slug: {
        equals: normalizedSlug,
        mode: 'insensitive',
      },
    },
  });
}

async function fetchPublishedBatches(categoryName?: string) {
  const where: Record<string, unknown> = {
    status: BatchStatus.PUBLISHED,
  };

  if (categoryName) {
    where.categoryName = categoryName;
  }

  // 使用 Prisma 关联字段名查询
  const rawBatches = await prisma.batch.findMany({
    where,
    include: {
      teaMasterRef: {
        select: {
          name: true,
          avatarUrl: true,
          role: true,
          experienceYears: true,
        },
      },
      gradeRef: {
        select: {
          name: true,
          badgeUrl: true,
        },
      },
    },
    orderBy: {
      productionDate: 'desc',
    },
    take: 50,
  });

  // 兼容旧接口字段名：将 teaMasterRef / gradeRef 映射为 teaMaster / grade
  return (rawBatches as any[]).map((batch) => {
    const { teaMasterRef, gradeRef, ...rest } = batch;
    return {
      ...rest,
      teaMaster: teaMasterRef,
      grade: gradeRef,
    };
  });
}

/**
 * 获取制作批次列表
 * GET /api/public/batches
 */
export async function getPublicBatches(req: Request, res: Response) {
  try {
    const { category, slug } = req.query;
    const categorySlugParam = req.query['category_slug'];

    const categoryNameQuery =
      typeof category === 'string' && category.trim().length > 0 ? category.trim() : undefined;
    const slugQuery = typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : undefined;
    const categorySlugQuery =
      typeof categorySlugParam === 'string' && categorySlugParam.trim().length > 0
        ? categorySlugParam.trim()
        : undefined;

    let resolvedCategoryName: string | undefined;
    let resolvedCategoryMeta:
      | {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          imageUrl: string | null;
        }
      | undefined;

    const slugToUse = categorySlugQuery || slugQuery;
    if (slugToUse) {
      const categoryRecord = await findCategoryBySlug(slugToUse);

      // 为了兼容旧前端：如果 slug 不存在，不再返回 404，而是返回空列表
      if (!categoryRecord) {
        console.warn('[getPublicBatches] 指定的品类 slug 不存在:', slugToUse);

        console.log('✅ 公开批次列表已发送，共 0 个批次（slug 未匹配到品类）');
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
          category: null,
        });
      }

      resolvedCategoryName = categoryRecord.name;
      resolvedCategoryMeta = {
        id: categoryRecord.id,
        name: categoryRecord.name,
        slug: categoryRecord.slug,
        description: categoryRecord.description,
        imageUrl: categoryRecord.imageUrl,
      };
    } else if (categoryNameQuery) {
      resolvedCategoryName = categoryNameQuery;
    }

    // 查询批次列表
    const batches = await fetchPublishedBatches(resolvedCategoryName);

    console.log(`✅ 公开批次列表已发送，共 ${batches.length} 个批次`);

    res.status(200).json({
      success: true,
      data: batches,
      count: batches.length,
      category: resolvedCategoryMeta,
    });
  } catch (error) {
    console.error('获取公开批次列表时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取数据时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取单个制作批次的完整详情
 * GET /api/public/batches/:id
 */
export async function getPublicBatchById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 查询批次详情（使用 Prisma 正确的关联字段名）
    const rawBatch = await prisma.batch.findUnique({
      where: { id },
      include: {
        teaMasterRef: {
          select: {
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            name: true,
            badgeUrl: true,
          },
        },
        batchHarvestRecords: {
          include: {
            harvestRecord: {
              include: {
                harvestLeader: {
                  select: {
                    name: true,
                    avatarUrl: true,
                    role: true,
                    experienceYears: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rawBatch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    const { teaMasterRef, gradeRef, batchHarvestRecords, ...restBatch } = rawBatch as any;

    // 保持旧接口字段命名：teaMaster / grade / batchLinks
    const batch = {
      ...restBatch,
      teaMaster: teaMasterRef,
      grade: gradeRef,
      batchLinks: batchHarvestRecords,
    };

    // 只有已发布的批次才能公开访问
    if (batch.status !== BatchStatus.PUBLISHED) {
      return res.status(403).json({
        success: false,
        message: '该批次尚未发布',
      });
    }

    console.log(`✅ 公开批次详情已发送 [${batch.batchNumber}]`);
    console.log(`   - 关联采摘记录: ${batch.batchLinks.length} 条`);

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error('获取公开批次详情时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取数据时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取某个品类的制作批次列表（根据 slug）
 * GET /api/public/categories/:slug/batches
 */
export async function getPublicBatchesByCategorySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    if (!slug || slug.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供品类 slug',
      });
    }

    const categoryRecord = await findCategoryBySlug(slug);

    // 为了兼容旧前端：如果 slug 不存在，不再返回 404，而是返回空列表
    if (!categoryRecord) {
      console.warn('[getPublicBatchesByCategorySlug] 指定的品类 slug 不存在:', slug);

      return res.status(200).json({
        success: true,
        category: null,
        data: [],
        count: 0,
      });
    }

    const batches = await fetchPublishedBatches(categoryRecord.name);

    res.status(200).json({
      success: true,
      category: {
        id: categoryRecord.id,
        name: categoryRecord.name,
        slug: categoryRecord.slug,
        description: categoryRecord.description,
        imageUrl: categoryRecord.imageUrl,
      },
      data: batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('通过品类 slug 获取公开批次列表时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器在获取数据时发生内部错误',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取所有领养方案
 * GET /api/public/adoption-plans
 */
export async function getPublicAdoptionPlans(req: Request, res: Response) {
  try {
    // 获取所有方案
    const plans = await prisma.adoptionPlan.findMany();

    // 如果某个方案不存在，创建默认方案
    const types = ['PRIVATE', 'ENTERPRISE', 'B2B'] as const;
    const planMap: Record<string, any> = {};

    for (const plan of plans) {
      planMap[plan.type] = plan;
    }

    for (const type of types) {
      if (!planMap[type]) {
        // 创建默认方案（确保带上 type 字段）
        const defaultData = getDefaultAdoptionPlanData(type);
        const newPlan = await prisma.adoptionPlan.create({
          data: defaultData,
        });
        planMap[type] = newPlan;
        console.log(`✅ 已自动创建 ${type} 方案的默认数据`);
      }
    }

    // 组织返回数据
    const result = {
      success: true,
      data: {
        private: planMap['PRIVATE'] || null,
        enterprise: planMap['ENTERPRISE'] || null,
        b2b: planMap['B2B'] || null,
      },
    };

    res.json(result);
  } catch (error) {
    console.error('获取公开领养方案失败:', error);
    res.status(500).json({
      success: false,
      message: '获取方案数据失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 获取默认领养方案数据
 */
function getDefaultAdoptionPlanData(type: 'PRIVATE' | 'ENTERPRISE' | 'B2B') {
  const baseData = {
    type: type,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (type === 'PRIVATE') {
    return {
      ...baseData,
      marketingHeader: { title: '私人定制茶园', subtitle: '专属您的茶园体验' },
      valuePropositions: [],
      customerCases: [],
      scenarioApplications: [],
      packages: [],
      comparisonPackageNames: [],
      comparisonFeatures: [],
      processSteps: [],
    };
  } else if (type === 'ENTERPRISE') {
    return {
      ...baseData,
      marketingHeader: { title: '企业定制茶园', subtitle: '为企业提供专属茶园服务' },
      customerCases: [],
      useScenarios: [],
      serviceContents: [],
      processSteps: [],
    };
  } else {
    return {
      ...baseData,
      description: 'B2B茶园服务方案',
    };
  }
}

