import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { pinyin } from 'pinyin-pro';

/**
 * 辅助函数：解析采摘期字符串为日期对象
 * @param periodString - 采摘期字符串 (例如 "8.4-9.30")
 * @param year - 年份，默认为当前年份
 * @returns 包含 start 和 end 日期的对象，解析失败返回 null
 */
function parsePeriodToDate(periodString: string, year: number = new Date().getFullYear()) {
  if (!periodString || typeof periodString !== 'string') {
    return null;
  }

  const parts = periodString.split('-');
  if (parts.length !== 2) {
    return null;
  }

  const startParts = parts[0].trim().split('.');
  const endParts = parts[1].trim().split('.');

  if (startParts.length !== 2 || endParts.length !== 2) {
    return null;
  }

  const startMonth = parseInt(startParts[0]);
  const startDay = parseInt(startParts[1]);
  const endMonth = parseInt(endParts[0]);
  const endDay = parseInt(endParts[1]);

  // 验证月份和日期的有效性
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    return null;
  }
  if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
    return null;
  }

  return {
    start: new Date(year, startMonth - 1, startDay, 0, 0, 0),
    end: new Date(year, endMonth - 1, endDay, 23, 59, 59, 999),
  };
}

/**
 * 辅助函数：从中文名称生成 slug
 * @param name - 中文名称
 * @returns slug 字符串
 */
function generateSlug(name: string): string {
  try {
    const pinyinResult = pinyin(name, {
      toneType: 'none',
      type: 'array',
    });

    let generatedSlug = Array.isArray(pinyinResult) ? pinyinResult.join('') : pinyinResult;
    generatedSlug = generatedSlug.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!generatedSlug) {
      generatedSlug = 'category-' + Date.now();
    }

    return generatedSlug;
  } catch (error) {
    console.error('生成slug时出错:', error);
    return 'category-' + Date.now();
  }
}

/**
 * 获取所有品类信息
 * GET /api/categories
 */
export async function getAllCategories(req: Request, res: Response) {
  try {
    const categories = await prisma.teaCategory.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    console.log(`✅ 成功获取 ${categories.length} 个品类信息`);

    // 禁用缓存，确保始终返回最新数据
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('获取品类信息时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取品类信息失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 创建新品类
 * POST /api/categories
 */
export async function createCategory(req: Request, res: Response) {
  try {
    const {
      name,
      image_url,
      description,
      yield_percentage,
      picking_period,
      picking_start_date,
      picking_end_date,
      sort_order,
    } = req.body;

    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '品类名称不能为空',
      });
    }

    // 验证产量占比
    const yieldNum = parseFloat(yield_percentage);
    if (yield_percentage !== undefined && (isNaN(yieldNum) || yieldNum < 0 || yieldNum > 100)) {
      return res.status(400).json({
        success: false,
        message: '产量占比必须是0-100之间的数字',
      });
    }

    // 自动从 picking_period 解析日期（如果未提供日期但提供了 picking_period）
    let finalStartDate = picking_start_date ? new Date(picking_start_date) : null;
    let finalEndDate = picking_end_date ? new Date(picking_end_date) : null;

    if (picking_period && picking_period.trim() && !picking_start_date && !picking_end_date) {
      const parsedDates = parsePeriodToDate(picking_period.trim());
      if (parsedDates) {
        finalStartDate = parsedDates.start;
        finalEndDate = parsedDates.end;
        console.log(
          `✅ 自动解析采摘期 "${picking_period}" 为日期: ${finalStartDate.toLocaleDateString()} - ${finalEndDate.toLocaleDateString()}`,
        );
      } else {
        console.log(`⚠️ 无法解析采摘期字符串 "${picking_period}"`);
      }
    }

    // 验证采摘期日期范围
    if (finalStartDate && finalEndDate) {
      if (finalStartDate > finalEndDate) {
        return res.status(400).json({
          success: false,
          message: '采摘开始日期不能晚于结束日期',
        });
      }
    }

    // 检查品类名称是否已存在
    const existingCategory = await prisma.teaCategory.findUnique({
      where: { name: name.trim() },
    });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: '品类名称已存在，请使用其他名称',
      });
    }

    // 生成 slug
    const slug = generateSlug(name.trim());

    // 创建新品类
    const newCategory = await prisma.teaCategory.create({
      data: {
        name: name.trim(),
        slug,
        imageUrl: image_url ? image_url.trim() : null,
        description: description ? description.trim() : null,
        yieldPercentage: yieldNum || 0,
        pickingPeriod: picking_period ? picking_period.trim() : null,
        pickingStartDate: finalStartDate,
        pickingEndDate: finalEndDate,
        sortOrder: sort_order !== undefined ? parseInt(sort_order) : 999,
      },
    });

    console.log(`✅ 成功创建品类: ${newCategory.name}`);

    res.status(201).json({
      success: true,
      message: '品类创建成功',
      data: newCategory,
    });
  } catch (error: any) {
    console.error('创建品类时发生错误:', error);

    // 处理 Prisma 唯一性约束错误
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '品类名称或slug已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '创建品类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 更新品类信息
 * PUT /api/categories/:id
 */
export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      image_url,
      description,
      yield_percentage,
      picking_period,
      picking_start_date,
      picking_end_date,
      sort_order,
    } = req.body;

    // 验证必填字段
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: '品类名称不能为空',
      });
    }

    // 验证产量占比
    if (yield_percentage !== undefined) {
      const yieldNum = parseFloat(yield_percentage);
      if (isNaN(yieldNum) || yieldNum < 0 || yieldNum > 100) {
        return res.status(400).json({
          success: false,
          message: '产量占比必须是0-100之间的数字',
        });
      }
    }

    // 自动从 picking_period 解析日期（如果提供了 picking_period 但未提供日期）
    let autoStartDate = null;
    let autoEndDate = null;

    if (
      picking_period !== undefined &&
      picking_period.trim() &&
      picking_start_date === undefined &&
      picking_end_date === undefined
    ) {
      const parsedDates = parsePeriodToDate(picking_period.trim());
      if (parsedDates) {
        autoStartDate = parsedDates.start;
        autoEndDate = parsedDates.end;
        console.log(
          `✅ 自动解析采摘期 "${picking_period}" 为日期: ${autoStartDate.toLocaleDateString()} - ${autoEndDate.toLocaleDateString()}`,
        );
      } else {
        console.log(`⚠️ 无法解析采摘期字符串 "${picking_period}"`);
      }
    }

    // 验证采摘期日期范围
    const finalStartDate =
      picking_start_date !== undefined
        ? picking_start_date
          ? new Date(picking_start_date)
          : null
        : autoStartDate;
    const finalEndDate =
      picking_end_date !== undefined
        ? picking_end_date
          ? new Date(picking_end_date)
          : null
        : autoEndDate;

    if (finalStartDate && finalEndDate && finalStartDate > finalEndDate) {
      return res.status(400).json({
        success: false,
        message: '采摘开始日期不能晚于结束日期',
      });
    }

    // 构建更新数据
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim();
      // 如果名称改变，重新生成 slug
      updateData.slug = generateSlug(name.trim());
    }
    if (image_url !== undefined) updateData.imageUrl = image_url.trim() || null;
    if (description !== undefined) updateData.description = description.trim() || null;
    if (yield_percentage !== undefined) updateData.yieldPercentage = parseFloat(yield_percentage) || 0;
    if (picking_period !== undefined) updateData.pickingPeriod = picking_period.trim() || null;

    // 如果提供了明确的日期，使用它们；否则使用自动解析的日期
    if (picking_start_date !== undefined) {
      updateData.pickingStartDate = picking_start_date ? new Date(picking_start_date) : null;
    } else if (autoStartDate) {
      updateData.pickingStartDate = autoStartDate;
    }

    if (picking_end_date !== undefined) {
      updateData.pickingEndDate = picking_end_date ? new Date(picking_end_date) : null;
    } else if (autoEndDate) {
      updateData.pickingEndDate = autoEndDate;
    }

    if (sort_order !== undefined) updateData.sortOrder = parseInt(sort_order) || 999;

    // 查找并更新品类
    const category = await prisma.teaCategory.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ 成功更新品类: ${category.name}`);

    res.json({
      success: true,
      message: '品类更新成功',
      data: category,
    });
  } catch (error: any) {
    console.error('更新品类时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '品类不存在',
      });
    }

    // 处理 Prisma 唯一性约束错误
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '品类名称或slug已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新品类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除品类
 * DELETE /api/categories/:id
 */
export async function deleteCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 查找并删除品类
    const category = await prisma.teaCategory.delete({
      where: { id },
    });

    console.log(`✅ 成功删除品类: ${category.name}`);

    res.json({
      success: true,
      message: '品类删除成功',
      data: category,
    });
  } catch (error: any) {
    console.error('删除品类时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '品类不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除品类失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 手动触发采摘记录重新归类
 * POST /api/categories/reclassify-harvest-records
 */
export async function reclassifyHarvestRecords(req: Request, res: Response) {
  try {
    console.log('🔄 开始重新归类所有采摘记录...');

    // 获取所有采摘记录
    const allRecords = await prisma.harvestRecord.findMany();

    let reclassifiedCount = 0;

    // 遍历每条记录，根据日期重新归类
    for (const record of allRecords) {
      if (!record.harvestDate) {
        continue;
      }

      // 查找符合日期范围的品类
      const category = await prisma.teaCategory.findFirst({
        where: {
          pickingStartDate: {
            lte: record.harvestDate,
          },
          pickingEndDate: {
            gte: record.harvestDate,
          },
        },
      });

      const oldCategoryId = record.categoryId;
      const newCategoryId = category?.id || null;
      const newCategoryName = category?.name || null;

      // 只有当分类发生变化时才更新
      if (oldCategoryId !== newCategoryId) {
        await prisma.harvestRecord.update({
          where: { id: record.id },
          data: {
            categoryId: newCategoryId,
            categoryName: newCategoryName,
          },
        });
        reclassifiedCount++;
      }
    }

    console.log(`🔄 已重新归类 ${reclassifiedCount} 条采摘记录`);

    res.json({
      success: true,
      message: `成功重新归类 ${reclassifiedCount} 条采摘记录`,
      count: reclassifiedCount,
    });
  } catch (error) {
    console.error('重新归类采摘记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '重新归类失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

