import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { FarmActivityType } from '@prisma/client';

const FARM_ACTIVITY_TYPE_MAP: Record<string, FarmActivityType> = {
  无: 'NONE',
  施肥: 'FERTILIZE',
  修剪: 'PRUNE',
  灌溉: 'IRRIGATE',
  采摘: 'HARVEST',
  异常: 'ABNORMAL',
};

function normalizeFarmActivityType(input?: string | null): FarmActivityType {
  if (!input) return 'NONE';

  const cleaned = String(input)
    // 去掉可能的 emoji 或前缀符号
    .replace(/^[\u{1F000}-\u{1FAFF}\u2600-\u26FF]+\s*/u, '')
    .trim();

  if (!cleaned) return 'NONE';

  if (FARM_ACTIVITY_TYPE_MAP[cleaned]) {
    return FARM_ACTIVITY_TYPE_MAP[cleaned];
  }

  // 兼容英文枚举值或已经是 Prisma 枚举
  if ((Object.values(FarmActivityType) as string[]).includes(cleaned)) {
    return cleaned as FarmActivityType;
  }

  return 'NONE';
}

/**
 * 辅助函数：为生长日志关联采摘记录信息
 */
async function enrichLogsWithHarvestInfo(logs: any[]) {
  if (!logs || logs.length === 0) {
    return logs;
  }

  // 提取所有日志日期
  const dates = logs.map((log) => new Date(log.date).toISOString().split('T')[0]);

  // 查询这些日期的采摘记录
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

  // 构建日期到采摘记录的映射
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

  // 为每个日志添加采摘信息
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
 * 获取所有已有日志的日期列表
 * GET /api/growth-logs/existing-dates
 */
export async function getExistingDates(req: Request, res: Response) {
  try {
    const logs = await prisma.dailyGrowthLog.findMany({
      select: {
        date: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const existingDates = logs.map((log) => {
      const date = new Date(log.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

    const uniqueDates = [...new Set(existingDates)];

    console.log(`✅ 成功获取 ${uniqueDates.length} 个已存在的日志日期`);

    res.json({
      success: true,
      data: uniqueDates,
      count: uniqueDates.length,
    });
  } catch (error) {
    console.error('获取已有日期列表时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取已有日期列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取每日生长日志列表
 * GET /api/growth-logs
 */
export async function getAllGrowthLogs(req: Request, res: Response) {
  try {
    const { month } = req.query;

    let logs;

    if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      // 按月份查询
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      logs = await prisma.dailyGrowthLog.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          plot: {
            select: {
              name: true,
            },
          },
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
          date: 'desc',
        },
      });
    } else {
      // 获取最近30天的日志
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      logs = await prisma.dailyGrowthLog.findMany({
        where: {
          date: {
            gte: thirtyDaysAgo,
          },
        },
        include: {
          plot: {
            select: {
              name: true,
            },
          },
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
          date: 'desc',
        },
        take: 100,
      });
    }

    // 关联采摘记录信息
    const enrichedLogs = await enrichLogsWithHarvestInfo(logs);

    console.log(`✅ 成功获取 ${enrichedLogs.length} 条每日生长日志（已关联采摘信息）`);

    res.json({
      success: true,
      data: enrichedLogs,
      count: enrichedLogs.length,
    });
  } catch (error) {
    console.error('获取每日生长日志时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取日志失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 根据日期查询每日生长日志的天气数据
 * GET /api/growth-logs/by-date
 */
export async function getWeatherByDate(req: Request, res: Response) {
  try {
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供日期参数',
      });
    }

    const inputDate = new Date(date);
    const startOfDay = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 23, 59, 59, 999);

    const log = await prisma.dailyGrowthLog.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (!log) {
      return res.json({
        success: true,
        data: null,
        message: '该日期暂无生长日志',
      });
    }

    res.json({
      success: true,
      data: {
        weather: (log.weather as any) || { icon: '', temperature_range: '' },
      },
    });
  } catch (error) {
    console.error('获取天气数据时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取天气数据失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 统计指定月份的日志数量
 * GET /api/growth-logs/count
 */
export async function getGrowthLogsCount(req: Request, res: Response) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '请提供月份参数 (格式: YYYY-MM)',
      });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const count = await prisma.dailyGrowthLog.count({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    res.json({
      success: true,
      data: {
        month: month,
        count: count,
      },
    });
  } catch (error) {
    console.error('统计日志数量时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '统计日志数量失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取单个每日生长日志
 * GET /api/growth-logs/:id
 */
export async function getGrowthLogById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const log = await prisma.dailyGrowthLog.findUnique({
      where: { id },
      include: {
        plot: {
          select: {
            name: true,
          },
        },
        recorder: {
          select: {
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: '日志不存在',
      });
    }

    // 关联采摘记录信息
    const enrichedLogs = await enrichLogsWithHarvestInfo([log]);
    const enrichedLog = enrichedLogs[0];

    console.log(`✅ 成功获取日志: ${new Date(log.date).toLocaleDateString('zh-CN')}（已关联采摘信息）`);

    res.json({
      success: true,
      data: enrichedLog,
    });
  } catch (error) {
    console.error('获取日志详情时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取日志详情失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 创建每日生长日志
 * POST /api/growth-logs
 */
export async function createGrowthLog(req: Request, res: Response) {
  try {
    const logData = req.body;

    if (!logData.date) {
      return res.status(400).json({
        success: false,
        message: '日期不能为空',
      });
    }

    // 检查日期是否重复
    const inputDate = new Date(logData.date);
    const startOfDay = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 23, 59, 59, 999);

    const existingLog = await prisma.dailyGrowthLog.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingLog) {
      const dateStr = startOfDay.toLocaleDateString('zh-CN');
      return res.status(409).json({
        success: false,
        message: `该日期（${dateStr}）已存在日志记录，请勿重复添加。`,
        existingLogId: existingLog.id,
      });
    }

    // 根据 recorder_name 查找并设置 recorder_id
    let recorderId = null;
    if (logData.recorder_name) {
      const recorderName = String(logData.recorder_name).trim();
      if (recorderName) {
        const personnel = await prisma.personnel.findFirst({
          where: {
            name: recorderName,
            role: 'RECORDER',
          },
        });

        if (personnel) {
          recorderId = personnel.id;
          console.log(`✅ 找到记录人: ${recorderName}, ID: ${personnel.id}`);
        } else {
          console.log(`⚠️ 未找到记录人: ${recorderName}，recorder_id 将为 null`);
        }
      }
    }

    // 根据农事活动类型动态生成 status_tag
    let statusTag: any = null;
    if (logData.farm_activity_type) {
      const activityType = logData.farm_activity_type;
      const statusTagMap: Record<string, any> = {
        施肥: { priority: 3, type: 'info', text: '施肥', color: '#17a2b8' },
        修剪: { priority: 3, type: 'info', text: '修剪', color: '#6c757d' },
        灌溉: { priority: 2, type: 'info', text: '灌溉', color: '#007bff' },
        采摘: { priority: 5, type: 'success', text: '采摘', color: '#28a745' },
        异常: { priority: 10, type: 'danger', text: '异常', color: '#dc3545' },
      };

      if (statusTagMap[activityType]) {
        statusTag = statusTagMap[activityType];
      } else if (activityType !== '无' && activityType !== '') {
        statusTag = {
          priority: 1,
          type: 'info',
          text: activityType,
          color: '#6c757d',
        };
      }
    }

    // 创建新日志
    const newLog = await prisma.dailyGrowthLog.create({
      data: {
        date: new Date(logData.date),
        plotId: logData.plot_id || null,
        recorderName: logData.recorder_name || null,
        recorderId: recorderId,
        mainImageUrl: logData.main_image_url || null,
        statusTag: statusTag,
        weather: logData.weather || null,
        summary: logData.summary || null,
        detailGallery: logData.detail_gallery || null,
        photoInfo: logData.photo_info || null,
        environmentData: logData.environment_data || null,
        fullLog: logData.full_log || null,
        farmActivityType: normalizeFarmActivityType(logData.farm_activity_type),
        farmActivityLog: logData.farm_activity_log || null,
        phenologicalObservation: logData.phenological_observation || null,
        abnormalEvent: logData.abnormal_event || null,
        harvestWeightKg: logData.harvest_weight_kg || 0,
      },
      include: {
        plot: {
          select: {
            name: true,
          },
        },
        recorder: {
          select: {
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
      },
    });

    console.log(`✅ 成功创建每日生长日志: ${new Date(newLog.date).toLocaleDateString('zh-CN')}`);
    console.log(`   - 农事活动: ${logData.farm_activity_type || '无'}`);
    console.log(`   - 状态标签: ${(newLog.statusTag as any)?.text || '无'}`);

    res.status(201).json({
      success: true,
      message: '日志创建成功',
      data: newLog,
    });
  } catch (error) {
    console.error('创建日志时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '创建日志失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 更新每日生长日志
 * PUT /api/growth-logs/:id
 */
export async function updateGrowthLog(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updatePayload = req.body;

    // 根据 recorder_name 查找并设置 recorder_id
    let recorderId: string | null = null;
    if ('recorder_name' in updatePayload) {
      const recorderName = String(updatePayload.recorder_name || '').trim();
      if (recorderName) {
        const personnel = await prisma.personnel.findFirst({
          where: {
            name: recorderName,
            role: 'RECORDER',
          },
        });

        if (personnel) {
          recorderId = personnel.id;
          console.log(`✅ 找到记录人: ${recorderName}, ID: ${personnel.id}`);
        } else {
          console.log(`⚠️ 未找到记录人: ${recorderName}，recorder_id 将为 null`);
        }
      }
    }

    // 根据农事活动类型动态生成 status_tag
    let statusTag: any = undefined;
    if ('farm_activity_type' in updatePayload) {
      const activityType = updatePayload.farm_activity_type;
      const statusTagMap: Record<string, any> = {
        施肥: { priority: 3, type: 'info', text: '施肥', color: '#17a2b8' },
        修剪: { priority: 3, type: 'info', text: '修剪', color: '#6c757d' },
        灌溉: { priority: 2, type: 'info', text: '灌溉', color: '#007bff' },
        采摘: { priority: 5, type: 'success', text: '采摘', color: '#28a745' },
        异常: { priority: 10, type: 'danger', text: '异常', color: '#dc3545' },
      };

      if (statusTagMap[activityType]) {
        statusTag = statusTagMap[activityType];
      } else if (activityType === '无' || activityType === '') {
        statusTag = {};
      } else {
        statusTag = {
          priority: 1,
          type: 'info',
          text: activityType,
          color: '#6c757d',
        };
      }
    }

    // 构建更新数据
    const updateData: any = {};
    if ('date' in updatePayload) updateData.date = new Date(updatePayload.date);
    if ('plot_id' in updatePayload) updateData.plotId = updatePayload.plot_id || null;
    if ('recorder_name' in updatePayload) updateData.recorderName = updatePayload.recorder_name || null;
    if (recorderId !== null) updateData.recorderId = recorderId;
    if ('main_image_url' in updatePayload) updateData.mainImageUrl = updatePayload.main_image_url || null;
    if (statusTag !== undefined) updateData.statusTag = statusTag;
    if ('weather' in updatePayload) updateData.weather = updatePayload.weather || null;
    if ('summary' in updatePayload) updateData.summary = updatePayload.summary || null;
    if ('detail_gallery' in updatePayload) updateData.detailGallery = updatePayload.detail_gallery || null;
    if ('photo_info' in updatePayload) updateData.photoInfo = updatePayload.photo_info || null;
    if ('environment_data' in updatePayload) updateData.environmentData = updatePayload.environment_data || null;
    if ('full_log' in updatePayload) updateData.fullLog = updatePayload.full_log || null;
    if ('farm_activity_type' in updatePayload) {
      updateData.farmActivityType = normalizeFarmActivityType(updatePayload.farm_activity_type);
    }
    if ('farm_activity_log' in updatePayload) updateData.farmActivityLog = updatePayload.farm_activity_log || null;
    if ('phenological_observation' in updatePayload)
      updateData.phenologicalObservation = updatePayload.phenological_observation || null;
    if ('abnormal_event' in updatePayload) updateData.abnormalEvent = updatePayload.abnormal_event || null;
    if ('harvest_weight_kg' in updatePayload) updateData.harvestWeightKg = updatePayload.harvest_weight_kg || 0;

    const updatedLog = await prisma.dailyGrowthLog.update({
      where: { id },
      data: updateData,
      include: {
        plot: {
          select: {
            name: true,
          },
        },
        recorder: {
          select: {
            name: true,
            avatarUrl: true,
            role: true,
            experienceYears: true,
          },
        },
      },
    });

    console.log(`✅ 成功更新日志: ${new Date(updatedLog.date).toLocaleDateString('zh-CN')}`);
    console.log(`   - 农事活动: ${updatePayload.farm_activity_type || '无'}`);
    console.log(`   - 状态标签: ${(updatedLog.statusTag as any)?.text || '无'}`);

    res.json({
      success: true,
      message: '日志更新成功',
      data: updatedLog,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '日志不存在',
      });
    }

    console.error('更新日志时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '更新日志失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除每日生长日志
 * DELETE /api/growth-logs/:id
 */
export async function deleteGrowthLog(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const log = await prisma.dailyGrowthLog.delete({
      where: { id },
    });

    console.log(`✅ 成功删除日志: ${new Date(log.date).toLocaleDateString('zh-CN')}`);

    res.json({
      success: true,
      message: '日志删除成功',
      data: log,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '日志不存在',
      });
    }

    console.error('删除日志时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '删除日志失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

