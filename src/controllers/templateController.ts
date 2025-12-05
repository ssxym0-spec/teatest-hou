import type { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ======================
// 制作步骤模板 (Production Step Templates)
// ======================

/**
 * 获取所有制作步骤模板
 * GET /api/step-templates
 */
export async function getAllStepTemplates(req: Request, res: Response) {
  try {
    const templates = await prisma.productionStepTemplate.findMany();

    // 按业务预设顺序排序，而不是按字典序
    const validSteps = ['摊晾', '杀青', '揉捻', '干燥', '分拣'];
    const sortOrderMap = new Map(validSteps.map((name, index) => [name, index]));
    const sorted = templates.sort((a, b) => {
      const aOrder = sortOrderMap.has(a.stepName) ? sortOrderMap.get(a.stepName)! : Number.MAX_SAFE_INTEGER;
      const bOrder = sortOrderMap.has(b.stepName) ? sortOrderMap.get(b.stepName)! : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    console.log(`✅ 成功获取 ${sorted.length} 个制作步骤模板`);

    res.json({
      success: true,
      data: templates,
      count: sorted.length,
    });
  } catch (error) {
    console.error('获取制作步骤模板时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 更新单个制作步骤模板
 * PUT /api/step-templates/:stepName
 */
export async function updateStepTemplate(req: Request, res: Response) {
  try {
    const { stepName } = req.params;
    const { manual_craft, modern_craft } = req.body;

    // 验证步骤名称
    const validSteps = ['摊晾', '杀青', '揉捻', '干燥', '分拣'];
    if (!validSteps.includes(stepName)) {
      return res.status(400).json({
        success: false,
        message: '无效的步骤名称',
      });
    }

    // 使用 upsert 创建或更新模板
    const template = await prisma.productionStepTemplate.upsert({
      where: { stepName },
      update: {
        manualCraft: manual_craft || { purpose: '', method: '', sensory_change: '', value: '' },
        modernCraft: modern_craft || { purpose: '', method: '', sensory_change: '', value: '' },
      },
      create: {
        stepName,
        manualCraft: manual_craft || { purpose: '', method: '', sensory_change: '', value: '' },
        modernCraft: modern_craft || { purpose: '', method: '', sensory_change: '', value: '' },
      },
    });

    console.log(`✅ 成功更新制作步骤模板: ${stepName}`);

    res.json({
      success: true,
      message: '模板更新成功',
      data: template,
    });
  } catch (error: any) {
    console.error('更新制作步骤模板时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '更新模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 批次详情标题模板 (Title Templates)
// ======================

/**
 * 获取所有批次详情标题模板
 * GET /api/title-templates
 */
export async function getAllTitleTemplates(req: Request, res: Response) {
  try {
    const templates = await prisma.titleTemplate.findMany({
      orderBy: {
        categoryName: 'asc',
      },
    });

    console.log(`✅ 成功获取 ${templates.length} 个批次详情标题模板`);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('获取批次详情标题模板时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 批量更新所有批次详情标题模板
 * POST /api/title-templates
 */
export async function updateTitleTemplates(req: Request, res: Response) {
  try {
    const { templates } = req.body;

    // 验证输入
    if (!Array.isArray(templates)) {
      return res.status(400).json({
        success: false,
        message: '模板数据必须是数组格式',
      });
    }

    // 验证每个模板的格式
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      if (!template.category_name || !template.title_template) {
        return res.status(400).json({
          success: false,
          message: `第 ${i + 1} 个模板缺少必要字段（category_name 或 title_template）`,
        });
      }
    }

    // 使用 Promise.all 并发执行所有更新操作
    const updatePromises = templates.map((template: any) =>
      prisma.titleTemplate.upsert({
        where: { categoryName: template.category_name },
        update: {
          titleTemplate: template.title_template,
        },
        create: {
          categoryName: template.category_name,
          titleTemplate: template.title_template,
        },
      }),
    );

    const results = await Promise.all(updatePromises);

    console.log(`✅ 成功批量更新 ${results.length} 个批次详情标题模板`);
    templates.forEach((template: any) => {
      console.log(`   - ${template.category_name}: ${template.title_template}`);
    });

    res.json({
      success: true,
      message: '所有模板保存成功',
      data: results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('批量更新批次详情标题模板时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '保存模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 鉴赏模板 (Appreciation Templates)
// ======================

/**
 * 获取所有鉴赏模板
 * GET /api/appreciation-templates
 */
export async function getAllAppreciationTemplates(req: Request, res: Response) {
  try {
    const templates = await prisma.appreciationTemplate.findMany({
      orderBy: {
        categoryName: 'asc',
      },
    });

    console.log(`✅ 成功获取 ${templates.length} 个鉴赏模板`);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('获取鉴赏模板时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 更新单个鉴赏模板
 * PUT /api/appreciation-templates/:categoryName
 */
export async function updateAppreciationTemplate(req: Request, res: Response) {
  try {
    const { categoryName } = req.params;
    const { tasting_notes, brewing_suggestion, storage_method } = req.body;

    console.log(`📝 正在更新鉴赏模板: ${categoryName}`);

    // 使用 upsert 创建或更新模板
    const template = await prisma.appreciationTemplate.upsert({
      where: { categoryName },
      update: {
        tastingNotes: tasting_notes || '',
        brewingSuggestion: brewing_suggestion || '',
        storageMethod: storage_method || '',
      },
      create: {
        categoryName,
        tastingNotes: tasting_notes || '',
        brewingSuggestion: brewing_suggestion || '',
        storageMethod: storage_method || '',
      },
    });

    console.log(`✅ 成功更新鉴赏模板: ${categoryName}`);

    res.json({
      success: true,
      message: '模板更新成功',
      data: template,
    });
  } catch (error: any) {
    console.error('更新鉴赏模板时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '更新模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除单个鉴赏模板
 * DELETE /api/appreciation-templates/:categoryName
 */
export async function deleteAppreciationTemplate(req: Request, res: Response) {
  try {
    const { categoryName } = req.params;

    const deletedTemplate = await prisma.appreciationTemplate.delete({
      where: { categoryName },
    });

    console.log(`✅ 成功删除鉴赏模板: ${categoryName}`);

    res.json({
      success: true,
      message: '模板删除成功',
      data: deletedTemplate,
    });
  } catch (error: any) {
    console.error('删除鉴赏模板时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '模板不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

