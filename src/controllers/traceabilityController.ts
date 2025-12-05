import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { PersonnelRole, BatchStatus } from '@prisma/client';

function normalizeBatchForClient(batch: any) {
  if (!batch) return batch;

  const {
    id,
    batchNumber,
    categoryName,
    teaMaster,
    teaMasterRef,
    productionSteps,
    tastingReport,
    productAppreciation,
    finalProductWeightKg,
    grade,
    gradeRef,
    productionDate,
    status,
    coverImageUrl,
    detailCoverImageUrl,
    imagesAndVideos,
    notes,
    detailTitle,
    batchHarvestRecords,
    ...rest
  } = batch;

  const resolvedTeaMaster = teaMasterRef || teaMaster || null;
  const resolvedGrade = gradeRef || (grade ? { name: grade } : null);

  return {
    // 原 Prisma 字段（camelCase）
    id,
    batchNumber,
    categoryName,
    teaMaster: resolvedTeaMaster,
    productionSteps,
    tastingReport,
    productAppreciation,
    finalProductWeightKg,
    grade: resolvedGrade?.name || grade || null,
    gradeRef: resolvedGrade || null,
    productionDate,
    status,
    coverImageUrl,
    detailCoverImageUrl,
    imagesAndVideos,
    notes,
    detailTitle,
    batchHarvestRecords,
    ...rest,

    // 兼容旧 Mongo 字段命名
    _id: id,
    batch_number: batchNumber,
    category_name: categoryName,
    tea_master: resolvedTeaMaster,
    production_steps: productionSteps,
    tasting_report: tastingReport,
    product_appreciation: productAppreciation,
    final_product_weight_kg: finalProductWeightKg,
    grade_name: resolvedGrade?.name || grade || null,
    production_date: productionDate,
    cover_image_url: coverImageUrl,
    detail_cover_image_url: detailCoverImageUrl,
    images_and_videos: imagesAndVideos,
    detail_title: detailTitle,
  };
}

/**
 * 创建制作批次
 * POST /api/batches
 */
export async function createBatch(req: Request, res: Response) {
  try {
    const batchData = req.body;

    // 验证必填字段
    if (!batchData.batch_number || !batchData.category_name) {
      return res.status(400).json({
        success: false,
        message: '批次号和茶叶品类不能为空',
      });
    }

    // 检查批次号是否已存在
    const existingBatch = await prisma.batch.findUnique({
      where: { batchNumber: batchData.batch_number },
    });
    if (existingBatch) {
      return res.status(409).json({
        success: false,
        message: `批次号 ${batchData.batch_number} 已存在，请使用不同的批次号`,
      });
    }

    // 根据 tea_master.name 查找并设置 tea_master_id
    let teaMasterId: string | null = null;
    if (batchData.tea_master?.name) {
      const masterName = batchData.tea_master.name.trim();
      if (masterName) {
        const personnel = await prisma.personnel.findFirst({
          where: {
            name: masterName,
            role: PersonnelRole.TEA_MASTER,
          },
        });

        if (personnel) {
          teaMasterId = personnel.id;
          console.log(`✅ 找到制茶师: ${masterName}, ID: ${personnel.id}`);
        } else {
          console.log(`⚠️ 未找到制茶师: ${masterName}，tea_master_id 将为 null`);
        }
      }
    }

    // 根据 grade（等级名称）查找并设置 grade_id
    let gradeId: string | null = null;
    if (batchData.grade) {
      const gradeName = batchData.grade.trim();
      if (gradeName) {
        const grade = await prisma.grade.findUnique({
          where: { name: gradeName },
        });
        if (grade) {
          gradeId = grade.id;
          console.log(`✅ 找到等级: ${gradeName}, ID: ${grade.id}`);
        } else {
          console.log(`⚠️ 未找到等级: ${gradeName}，grade_id 将为 null`);
        }
      }
    }

    // 提取 harvest_records_ids
    const harvestRecordsIds = batchData.harvest_records_ids || [];

    // 如果没有提供 production_steps，初始化五个"匠心制作"步骤
    let productionSteps = batchData.production_steps;
    if (!productionSteps || productionSteps.length === 0) {
      productionSteps = [
        {
          step_name: '摊晾',
          step_order: 1,
          manual_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          modern_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          description: '',
          images: [],
        },
        {
          step_name: '杀青',
          step_order: 2,
          manual_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          modern_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          description: '',
          images: [],
        },
        {
          step_name: '揉捻',
          step_order: 3,
          manual_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          modern_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          description: '',
          images: [],
        },
        {
          step_name: '干燥',
          step_order: 4,
          manual_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          modern_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          description: '',
          images: [],
        },
        {
          step_name: '分拣',
          step_order: 5,
          manual_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          modern_craft: { media_urls: [], purpose: '', method: '', sensory_change: '', value: '' },
          description: '',
          images: [],
        },
      ];
    }

    // 使用事务创建批次并关联采摘记录
    const result = await prisma.$transaction(async (tx) => {
      // 第一步：创建 Batch
      const newBatch = await tx.batch.create({
        data: {
          batchNumber: batchData.batch_number,
          categoryName: batchData.category_name,
          teaMaster: batchData.tea_master || null,
          teaMasterId: teaMasterId,
          productionSteps: productionSteps as any,
          tastingReport: batchData.tasting_report || null,
          productAppreciation: batchData.product_appreciation || null,
          finalProductWeightKg: batchData.final_product_weight_kg
            ? parseFloat(batchData.final_product_weight_kg)
            : null,
          grade: batchData.grade || null,
          gradeId: gradeId,
          productionDate: batchData.production_date ? new Date(batchData.production_date) : new Date(),
          status: (batchData.status as BatchStatus) || BatchStatus.IN_PROGRESS,
          coverImageUrl: batchData.cover_image_url || null,
          detailCoverImageUrl: batchData.detail_cover_image_url || null,
          imagesAndVideos: batchData.images_and_videos || [],
          notes: batchData.notes || null,
          detailTitle: batchData.detail_title || null,
        },
      });

      console.log(`✅ 成功创建制作批次: ${newBatch.batchNumber}, 品类: ${newBatch.categoryName}`);
      console.log(`   - 批次 ID: ${newBatch.id}`);
      console.log(`   - 制作步骤: ${(productionSteps as any[]).length} 个`);

      // 第二步：创建 BatchHarvestRecord 联结表记录并更新 HarvestRecord
      if (harvestRecordsIds.length > 0) {
        // 验证采摘记录是否存在
        const existingRecords = await tx.harvestRecord.findMany({
          where: {
            id: { in: harvestRecordsIds },
          },
        });

        if (existingRecords.length !== harvestRecordsIds.length) {
          throw new Error('部分采摘记录不存在');
        }

        // 创建联结表记录
        await tx.batchHarvestRecord.createMany({
          data: harvestRecordsIds.map((hrId: string) => ({
            batchId: newBatch.id,
            harvestRecordId: hrId,
          })),
        });

        // 更新采摘记录的 assigned_batch_id
        await tx.harvestRecord.updateMany({
          where: {
            id: { in: harvestRecordsIds },
          },
          data: {
            assignedBatchId: newBatch.id,
          },
        });

        console.log(`✅ 已将 ${harvestRecordsIds.length} 条采摘记录关联到批次 ${newBatch.batchNumber}`);
      }

      // 第三步：返回完整的批次数据（包含关联）
      const populatedBatch = await tx.batch.findUnique({
        where: { id: newBatch.id },
        include: {
          teaMasterRef: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              experienceYears: true,
            },
          },
          gradeRef: {
            select: {
              id: true,
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
                      id: true,
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

      return normalizeBatchForClient(populatedBatch);
    });

    res.status(201).json({
      success: true,
      message: '制作批次创建成功',
      data: result,
    });
  } catch (error: any) {
    console.error('❌❌❌ 创建制作批次时发生错误 ❌❌❌');
    console.error('错误类型:', error.name);
    console.error('错误消息:', error.message);
    console.error('完整错误:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        detail: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: '创建制作批次失败',
      error: error.message,
      detail: process.env.NODE_ENV === 'development' ? error.stack : '服务器内部错误',
    });
  }
}

/**
 * 获取所有制作批次
 * GET /api/batches
 */
export async function getAllBatches(req: Request, res: Response) {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: {
        productionDate: 'desc',
      },
      take: 200,
      include: {
        teaMasterRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            id: true,
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
                    id: true,
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

    console.log(`✅ 成功获取 ${batches.length} 个制作批次`);

    const normalized = batches.map((b) => normalizeBatchForClient(b));

    res.json({
      success: true,
      data: normalized,
      count: normalized.length,
    });
  } catch (error) {
    console.error('获取制作批次时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取制作批次失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取单个制作批次
 * GET /api/batches/:id
 */
export async function getBatchById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        teaMasterRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            id: true,
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
                    id: true,
                    name: true,
                    avatarUrl: true,
                    role: true,
                    experienceYears: true,
                  },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    res.json({
      success: true,
      data: normalizeBatchForClient(batch),
    });
  } catch (error) {
    console.error('获取制作批次详情时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取制作批次详情失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 更新制作批次的基础信息
 * PUT /api/batches/:id
 */
export async function updateBatch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 根据 tea_master.name 查找并设置 tea_master_id
    let teaMasterId: string | null | undefined = undefined;
    if (updateData.tea_master?.name !== undefined) {
      if (updateData.tea_master?.name) {
        const masterName = updateData.tea_master.name.trim();
        if (masterName) {
          const personnel = await prisma.personnel.findFirst({
            where: {
              name: masterName,
              role: PersonnelRole.TEA_MASTER,
            },
          });

          if (personnel) {
            teaMasterId = personnel.id;
            console.log(`✅ 找到制茶师: ${masterName}, ID: ${personnel.id}`);
          } else {
            console.log(`⚠️ 未找到制茶师: ${masterName}，tea_master_id 将为 null`);
            teaMasterId = null;
          }
        } else {
          teaMasterId = null;
        }
      } else {
        teaMasterId = null;
      }
    }

    // 根据 grade（等级名称）查找并设置 grade_id
    let gradeId: string | null | undefined = undefined;
    if (updateData.grade !== undefined) {
      if (updateData.grade) {
        const gradeName = updateData.grade.trim();
        if (gradeName) {
          const grade = await prisma.grade.findUnique({
            where: { name: gradeName },
          });
          if (grade) {
            gradeId = grade.id;
            console.log(`✅ 找到等级: ${gradeName}, ID: ${grade.id}`);
          } else {
            console.log(`⚠️ 未找到等级: ${gradeName}，grade_id 将为 null`);
            gradeId = null;
          }
        } else {
          gradeId = null;
        }
      } else {
        gradeId = null;
      }
    }

    // 构建更新数据
    const data: any = {};
    if (updateData.batch_number !== undefined) data.batchNumber = updateData.batch_number;
    if (updateData.category_name !== undefined) data.categoryName = updateData.category_name;
    if (updateData.tea_master !== undefined) data.teaMaster = updateData.tea_master;
    if (teaMasterId !== undefined) data.teaMasterId = teaMasterId;
    if (updateData.tasting_report !== undefined) data.tastingReport = updateData.tasting_report;
    if (updateData.product_appreciation !== undefined) data.productAppreciation = updateData.product_appreciation;
    if (updateData.final_product_weight_kg !== undefined)
      data.finalProductWeightKg = updateData.final_product_weight_kg ? parseFloat(updateData.final_product_weight_kg) : null;
    if (updateData.grade !== undefined) data.grade = updateData.grade || null;
    if (gradeId !== undefined) data.gradeId = gradeId;
    if (updateData.production_date !== undefined) data.productionDate = updateData.production_date ? new Date(updateData.production_date) : null;
    if (updateData.status !== undefined) data.status = updateData.status as BatchStatus;
    if (updateData.cover_image_url !== undefined) data.coverImageUrl = updateData.cover_image_url || null;
    if (updateData.detail_cover_image_url !== undefined) data.detailCoverImageUrl = updateData.detail_cover_image_url || null;
    if (updateData.images_and_videos !== undefined) data.imagesAndVideos = updateData.images_and_videos;
    if (updateData.notes !== undefined) data.notes = updateData.notes || null;
    if (updateData.detail_title !== undefined) data.detailTitle = updateData.detail_title || null;

    const updatedBatch = await prisma.batch.update({
      where: { id },
      data,
      include: {
        teaMasterRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            id: true,
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
                    id: true,
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

    console.log(`✅ 成功更新制作批次: ${updatedBatch.batchNumber}`);

    res.json({
      success: true,
      message: '制作批次更新成功',
      data: normalizeBatchForClient(updatedBatch),
    });
  } catch (error: any) {
    console.error('更新制作批次时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新制作批次失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 更新制作批次的制作步骤
 * PUT /api/batches/:id/production-steps
 */
export async function updateBatchProductionSteps(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { production_steps } = req.body;

    // 验证输入
    if (!Array.isArray(production_steps)) {
      return res.status(400).json({
        success: false,
        message: '制作步骤必须是数组格式',
      });
    }

    // 验证步骤格式
    for (let i = 0; i < production_steps.length; i++) {
      const step = production_steps[i];
      if (!step.step_name || step.step_order === undefined) {
        return res.status(400).json({
          success: false,
          message: `第 ${i + 1} 个步骤缺少必要字段（step_name 或 step_order）`,
        });
      }

      // 验证 craft_type 字段（如果存在）
      if (step.craft_type && !['manual', 'modern', 'none'].includes(step.craft_type)) {
        return res.status(400).json({
          success: false,
          message: `第 ${i + 1} 个步骤的 craft_type 值无效，必须是 'manual'、'modern' 或 'none'`,
        });
      }
    }

    const updatedBatch = await prisma.batch.update({
      where: { id },
      data: {
        productionSteps: production_steps as any,
      },
      include: {
        teaMasterRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            id: true,
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
                    id: true,
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

    console.log(`✅ 成功更新批次 ${updatedBatch.batchNumber} 的制作步骤（${production_steps.length} 个）`);

    res.json({
      success: true,
      message: '制作步骤更新成功',
      data: normalizeBatchForClient(updatedBatch),
    });
  } catch (error: any) {
    console.error('更新制作步骤时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新制作步骤失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 精细化更新制作步骤的某个工艺类型
 * PUT /api/batches/:batchId/steps/:stepIndex/:craftType
 */
export async function updateBatchStepCraft(req: Request, res: Response) {
  try {
    const { batchId, stepIndex, craftType } = req.params;
    const craftData = req.body;

    // 验证参数
    const stepIdx = parseInt(stepIndex);
    if (isNaN(stepIdx) || stepIdx < 0 || stepIdx > 4) {
      return res.status(400).json({
        success: false,
        message: '步骤索引必须是 0-4 之间的数字',
      });
    }

    if (craftType !== 'manual' && craftType !== 'modern') {
      return res.status(400).json({
        success: false,
        message: '工艺类型必须是 manual 或 modern',
      });
    }

    // 验证 media_urls 字段
    if (craftData.media_urls !== undefined && !Array.isArray(craftData.media_urls)) {
      return res.status(400).json({
        success: false,
        message: 'media_urls 必须是数组格式',
      });
    }

    // 查找批次
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    // 确保 production_steps 存在且有足够的步骤
    const productionSteps = (batch.productionSteps as any) || [];
    if (productionSteps.length <= stepIdx) {
      return res.status(400).json({
        success: false,
        message: `批次中不存在索引为 ${stepIdx} 的制作步骤`,
      });
    }

    // 更新指定步骤的工艺数据
    const updatedSteps = [...productionSteps];
    const step = updatedSteps[stepIdx];

    if (!step[`${craftType}_craft`]) {
      step[`${craftType}_craft`] = {};
    }

    if (craftData.media_urls !== undefined) {
      step[`${craftType}_craft`].media_urls = craftData.media_urls;
    }
    if (craftData.purpose !== undefined) {
      step[`${craftType}_craft`].purpose = craftData.purpose;
    }
    if (craftData.method !== undefined) {
      step[`${craftType}_craft`].method = craftData.method;
    }
    if (craftData.sensory_change !== undefined) {
      step[`${craftType}_craft`].sensory_change = craftData.sensory_change;
    }
    if (craftData.value !== undefined) {
      step[`${craftType}_craft`].value = craftData.value;
    }

    updatedSteps[stepIdx] = step;

    const updatedBatch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        productionSteps: updatedSteps as any,
      },
      include: {
        teaMasterRef: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
        gradeRef: {
          select: {
            id: true,
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
                    id: true,
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

    const stepName = step.step_name;
    const craftTypeName = craftType === 'manual' ? '手工匠心' : '现代工艺';

    console.log(`✅ 成功更新批次 ${updatedBatch.batchNumber} 的 ${stepName} - ${craftTypeName}`);

    res.json({
      success: true,
      message: `${stepName} - ${craftTypeName} 保存成功`,
      data: normalizeBatchForClient(updatedBatch),
    });
  } catch (error: any) {
    console.error('更新制作步骤时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除制作批次
 * DELETE /api/batches/:id
 */
export async function deleteBatch(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        batchHarvestRecords: true,
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    // 使用事务删除批次并解除关联
    await prisma.$transaction(async (tx) => {
      // 获取所有关联的采摘记录 ID
      const harvestRecordIds = batch.batchHarvestRecords.map((bhr) => bhr.harvestRecordId);

      // 删除联结表记录
      await tx.batchHarvestRecord.deleteMany({
        where: {
          batchId: id,
        },
      });

      // 将关联的采摘记录的 assigned_batch_id 设回 null
      if (harvestRecordIds.length > 0) {
        await tx.harvestRecord.updateMany({
          where: {
            id: { in: harvestRecordIds },
          },
          data: {
            assignedBatchId: null,
          },
        });
        console.log(`✅ 已将 ${harvestRecordIds.length} 条采摘记录解除关联`);
      }

      // 删除批次
      await tx.batch.delete({
        where: { id },
      });
    });

    console.log(`✅ 成功删除制作批次: ${batch.batchNumber}`);

    res.json({
      success: true,
      message: '制作批次删除成功',
      data: normalizeBatchForClient(batch),
    });
  } catch (error: any) {
    console.error('删除制作批次时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '制作批次不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除制作批次失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

