import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { PersonnelRole } from '@prisma/client';

/**
 * 辅助函数：根据采摘日期在品类列表中查找匹配的品类
 * @param harvestDate - 采摘日期
 * @param allCategories - 所有品类列表
 * @returns 匹配的品类ID和名称，如果未匹配则返回 null
 */
function findCategoryIdForDate(
  harvestDate: Date,
  allCategories: Array<{
    id: string;
    name: string;
    pickingStartDate: Date | null;
    pickingEndDate: Date | null;
  }>,
): { categoryId: string; categoryName: string } | { categoryId: null; categoryName: null } {
  if (!harvestDate || !allCategories || allCategories.length === 0) {
    return { categoryId: null, categoryName: null };
  }

  // 获取采摘日期的年月日
  const harvestYear = harvestDate.getFullYear();
  const harvestMonth = harvestDate.getMonth();
  const harvestDay = harvestDate.getDate();

  // 遍历所有品类，查找匹配的日期范围
  for (const category of allCategories) {
    // 如果品类没有设置日期范围，跳过
    if (!category.pickingStartDate || !category.pickingEndDate) {
      continue;
    }

    // 将品类日期调整到采摘日期的年份进行比较
    // 这样可以处理品类日期可能是不同年份的情况
    const startDate = new Date(
      harvestYear,
      category.pickingStartDate.getMonth(),
      category.pickingStartDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const endDate = new Date(
      harvestYear,
      category.pickingEndDate.getMonth(),
      category.pickingEndDate.getDate(),
      23,
      59,
      59,
      999,
    );

    // 将采摘日期标准化为当天的开始时间
    const harvestDateOnly = new Date(harvestYear, harvestMonth, harvestDay, 0, 0, 0, 0);

    // 检查采摘日期是否在品类日期范围内
    // harvestDate 的 00:00:00 应该 >= startDate 的 00:00:00
    // harvestDate 的 00:00:00 应该 <= endDate 的 23:59:59.999
    if (harvestDateOnly >= startDate && harvestDateOnly <= endDate) {
      console.log(
        `✅ 匹配成功: 采摘日期 ${harvestDateOnly.toISOString()} 匹配到品类 ${category.name} (${startDate.toISOString()} ~ ${endDate.toISOString()})`,
      );
      return {
        categoryId: category.id,
        categoryName: category.name,
      };
    } else {
      // 调试日志：记录不匹配的原因
      console.log(
        `🔍 检查品类 ${category.name}: 采摘日期 ${harvestDateOnly.toISOString()}, 范围 ${startDate.toISOString()} ~ ${endDate.toISOString()}, 匹配: ${harvestDateOnly >= startDate && harvestDateOnly <= endDate}`,
      );
    }
  }

  // 未找到匹配的品类
  console.log(
    `⚠️ 未找到匹配的品类: 采摘日期 ${harvestDate.toISOString()} (${harvestYear}-${harvestMonth + 1}-${harvestDay})`,
  );
  return { categoryId: null, categoryName: null };
}

/**
 * 辅助函数：根据采摘日期自动归类到品类
 * 预先加载所有品类，然后在内存中匹配
 */
async function classifyHarvestRecordByDate(harvestDate: Date) {
  if (!harvestDate) {
    return { categoryId: null, categoryName: null };
  }

  // 预先加载所有品类及其日期范围
  const allCategories = await prisma.teaCategory.findMany({
    select: {
      id: true,
      name: true,
      pickingStartDate: true,
      pickingEndDate: true,
    },
  });

  // 使用辅助函数在内存中匹配
  return findCategoryIdForDate(harvestDate, allCategories);
}

/**
 * 创建采摘记录
 * POST /api/harvest-records
 */
export async function createHarvestRecord(req: Request, res: Response) {
  try {
    const recordData = req.body;

    // 验证必填字段
    if (!recordData.harvest_date || !recordData.fresh_leaf_weight_kg) {
      return res.status(400).json({
        success: false,
        message: '采摘日期和鲜叶重量不能为空',
      });
    }

    // 验证团队人数
    const memberCount = recordData.harvest_team?.member_count;
    if (!memberCount || memberCount < 1 || !Number.isInteger(memberCount)) {
      return res.status(400).json({
        success: false,
        message: '采摘团队人数至少1人',
      });
    }

    // 根据 harvest_team.leader_name 查找并设置 harvest_team_id
    let harvestTeamId: string | null = null;
    if (recordData.harvest_team?.leader_name) {
      const leaderName = recordData.harvest_team.leader_name.trim();
      if (leaderName) {
        const personnel = await prisma.personnel.findFirst({
          where: {
            name: leaderName,
            role: PersonnelRole.HARVEST_LEAD,
          },
        });

        if (personnel) {
          harvestTeamId = personnel.id;
          console.log(`✅ 找到采摘队长: ${leaderName}, ID: ${personnel.id}`);
        } else {
          console.log(`⚠️ 未找到采摘队长: ${leaderName}，harvest_team_id 将为 null`);
        }
      }
    }

    // 自动归类到品类
    const harvestDate = new Date(recordData.harvest_date);
    const { categoryId, categoryName } = await classifyHarvestRecordByDate(harvestDate);

    // 创建新的采摘记录
    const newRecord = await prisma.harvestRecord.create({
      data: {
        harvestDate,
        freshLeafWeightKg: parseFloat(recordData.fresh_leaf_weight_kg),
        weather: recordData.weather || null,
        imagesAndVideos: recordData.images_and_videos || [],
        mediaUrls: recordData.media_urls || [],
        harvestTeam: recordData.harvest_team || null,
        harvestTeamId,
        categoryId,
        categoryName,
        notes: recordData.notes || null,
      },
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
    });

    const formattedDate = harvestDate.toISOString().split('T')[0];
    console.log(`✅ 成功创建采摘记录: ${formattedDate}, 重量: ${newRecord.freshLeafWeightKg}kg`);

    res.status(201).json({
      success: true,
      message: '采摘记录创建成功',
      data: newRecord,
    });
  } catch (error: any) {
    console.error('创建采摘记录时发生错误:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
      });
    }

    res.status(500).json({
      success: false,
      message: '创建采摘记录失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 获取所有采摘记录
 * GET /api/harvest-records
 * 支持按月份查询：/api/harvest-records?month=2025-01
 */
export async function getAllHarvestRecords(req: Request, res: Response) {
  try {
    const { month } = req.query;
    let where: any = {};

    // 如果提供了月份参数，筛选该月份的记录
    if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);

      where.harvestDate = {
        gte: startDate,
        lte: endDate,
      };

      console.log(`📅 查询月份: ${month} (${startDate.toISOString()} ~ ${endDate.toISOString()})`);
    }

    const records = await prisma.harvestRecord.findMany({
      where,
      orderBy: {
        harvestDate: 'desc',
      },
      take: 500,
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
    });

    console.log(`✅ 成功获取 ${records.length} 条采摘记录${month ? ` (${month})` : ''}`);

    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    console.error('获取采摘记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取采摘记录失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取未归属的采摘记录
 * GET /api/harvest-records/unassigned
 */
export async function getUnassignedHarvestRecords(req: Request, res: Response) {
  try {
    const unassignedRecords = await prisma.harvestRecord.findMany({
      where: {
        assignedBatchId: null,
      },
      orderBy: {
        harvestDate: 'desc',
      },
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
    });

    console.log(`✅ 成功获取 ${unassignedRecords.length} 条未归属的采摘记录`);

    res.json({
      success: true,
      data: unassignedRecords,
      count: unassignedRecords.length,
    });
  } catch (error) {
    console.error('获取未归属采摘记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取未归属采摘记录失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取单个采摘记录
 * GET /api/harvest-records/:id
 */
export async function getHarvestRecordById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const record = await prisma.harvestRecord.findUnique({
      where: { id },
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
        assignedBatch: {
          select: {
            id: true,
            batchNumber: true,
            categoryName: true,
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '采摘记录不存在',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('获取采摘记录详情时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取采摘记录详情失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 更新采摘记录
 * PUT /api/harvest-records/:id
 */
export async function updateHarvestRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 验证团队人数
    if (updateData.harvest_team?.member_count !== undefined) {
      const memberCount = updateData.harvest_team.member_count;
      if (!memberCount || memberCount < 1 || !Number.isInteger(memberCount)) {
        return res.status(400).json({
          success: false,
          message: '采摘团队人数至少1人',
        });
      }
    }

    // 根据 harvest_team.leader_name 查找并设置 harvest_team_id
    let harvestTeamId: string | null | undefined = undefined;
    if (updateData.harvest_team?.leader_name !== undefined) {
      if (updateData.harvest_team.leader_name) {
        const leaderName = updateData.harvest_team.leader_name.trim();
        if (leaderName) {
          const personnel = await prisma.personnel.findFirst({
            where: {
              name: leaderName,
              role: PersonnelRole.HARVEST_LEAD,
            },
          });

          if (personnel) {
            harvestTeamId = personnel.id;
            console.log(`✅ 找到采摘队长: ${leaderName}, ID: ${personnel.id}`);
          } else {
            console.log(`⚠️ 未找到采摘队长: ${leaderName}，harvest_team_id 将为 null`);
            harvestTeamId = null;
          }
        } else {
          harvestTeamId = null;
        }
      } else {
        harvestTeamId = null;
      }
    }

    // 构建更新数据
    const data: any = {};
    if (updateData.harvest_date !== undefined) {
      data.harvestDate = new Date(updateData.harvest_date);
      // 如果日期改变，重新归类
      const { categoryId, categoryName } = await classifyHarvestRecordByDate(data.harvestDate);
      data.categoryId = categoryId;
      data.categoryName = categoryName;
    }
    if (updateData.fresh_leaf_weight_kg !== undefined) {
      data.freshLeafWeightKg = parseFloat(updateData.fresh_leaf_weight_kg);
    }
    if (updateData.weather !== undefined) data.weather = updateData.weather;
    if (updateData.images_and_videos !== undefined) data.imagesAndVideos = updateData.images_and_videos;
    if (updateData.media_urls !== undefined) data.mediaUrls = updateData.media_urls;
    if (updateData.harvest_team !== undefined) data.harvestTeam = updateData.harvest_team;
    if (harvestTeamId !== undefined) data.harvestTeamId = harvestTeamId;
    if (updateData.notes !== undefined) data.notes = updateData.notes || null;

    const updatedRecord = await prisma.harvestRecord.update({
      where: { id },
      data,
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
    });

    const formattedDate = updatedRecord.harvestDate.toISOString().split('T')[0];
    console.log(`✅ 成功更新采摘记录: ${formattedDate}`);

    res.json({
      success: true,
      message: '采摘记录更新成功',
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error('更新采摘记录时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '采摘记录不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新采摘记录失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除采摘记录
 * DELETE /api/harvest-records/:id
 */
export async function deleteHarvestRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const record = await prisma.harvestRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '采摘记录不存在',
      });
    }

    // 如果记录已关联到批次，需要先解除关联
    if (record.assignedBatchId) {
      // 删除联结表记录
      await prisma.batchHarvestRecord.deleteMany({
        where: {
          harvestRecordId: id,
        },
      });

      // 更新采摘记录的 assigned_batch_id
      await prisma.harvestRecord.update({
        where: { id },
        data: {
          assignedBatchId: null,
        },
      });
    }

    // 删除采摘记录
    await prisma.harvestRecord.delete({
      where: { id },
    });

    const formattedDate = record.harvestDate.toISOString().split('T')[0];
    console.log(`✅ 成功删除采摘记录: ${formattedDate}`);

    res.json({
      success: true,
      message: '采摘记录删除成功',
      data: record,
    });
  } catch (error: any) {
    console.error('删除采摘记录时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '采摘记录不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除采摘记录失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 批量同步采摘记录的天气数据
 * POST /api/harvest-records/sync-weather
 */
export async function syncHarvestRecordsWeather(req: Request, res: Response) {
  try {
    console.log('🔄 开始批量同步采摘记录的天气数据...');

    // 获取所有采摘记录
    const allRecords = await prisma.harvestRecord.findMany();
    console.log(`📊 共找到 ${allRecords.length} 条采摘记录`);

    let syncedCount = 0;
    let noDataCount = 0;
    let errorCount = 0;
    const syncResults: any[] = [];

    for (const record of allRecords) {
      try {
        const harvestDate = new Date(record.harvestDate);

        // 构建日期范围（当天的0点到23:59:59）
        const startOfDay = new Date(
          harvestDate.getFullYear(),
          harvestDate.getMonth(),
          harvestDate.getDate(),
          0,
          0,
          0,
          0,
        );
        const endOfDay = new Date(
          harvestDate.getFullYear(),
          harvestDate.getMonth(),
          harvestDate.getDate(),
          23,
          59,
          59,
          999,
        );

        // 查找对应日期的生长日志
        const growthLog = await prisma.dailyGrowthLog.findFirst({
          where: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (growthLog && growthLog.weather) {
          // 更新采摘记录的天气数据
          const weatherData = growthLog.weather as any;
          await prisma.harvestRecord.update({
            where: { id: record.id },
            data: {
              weather: {
                icon: weatherData.icon || '',
                temperature_range: weatherData.temperature_range || '',
              },
            },
          });

          syncedCount++;
          const formattedDate = harvestDate.toISOString().split('T')[0];
          syncResults.push({
            date: formattedDate,
            status: 'synced',
            weather: growthLog.weather,
          });

          console.log(`✅ [${formattedDate}] 天气已同步: ${weatherData.icon} ${weatherData.temperature_range}`);
        } else {
          noDataCount++;
          const formattedDate = harvestDate.toISOString().split('T')[0];
          syncResults.push({
            date: formattedDate,
            status: 'no_data',
            message: '该日期没有生长日志',
          });

          console.log(`⚠️ [${formattedDate}] 该日期没有生长日志`);
        }
      } catch (error: any) {
        errorCount++;
        const formattedDate = record.harvestDate.toISOString().split('T')[0];
        syncResults.push({
          date: formattedDate,
          status: 'error',
          error: error.message,
        });

        console.error(`❌ [${formattedDate}] 同步失败:`, error.message);
      }
    }

    console.log(`\n📊 同步完成统计:`);
    console.log(`   ✅ 成功同步: ${syncedCount} 条`);
    console.log(`   ⚠️ 无数据: ${noDataCount} 条`);
    console.log(`   ❌ 失败: ${errorCount} 条`);

    res.json({
      success: true,
      message: '天气数据同步完成',
      data: {
        total: allRecords.length,
        synced: syncedCount,
        noData: noDataCount,
        errors: errorCount,
        details: syncResults,
      },
    });
  } catch (error) {
    console.error('❌ 批量同步天气数据失败:', error);
    res.status(500).json({
      success: false,
      message: '批量同步天气数据失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

