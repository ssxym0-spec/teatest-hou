import type { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * 获取月度汇总列表
 * GET /api/monthly-summaries
 */
export async function getAllMonthlySummaries(req: Request, res: Response) {
  try {
    const { month } = req.query;

    let summaries;

    if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      // 按月份查询单个汇总
      const summary = await prisma.monthlySummary.findUnique({
        where: {
          yearMonth: month,
        },
        include: {
          plot: {
            select: {
              name: true,
            },
          },
        },
      });

      summaries = summary ? [summary] : [];
    } else {
      // 获取最近6个月的汇总
      summaries = await prisma.monthlySummary.findMany({
        include: {
          plot: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          yearMonth: 'desc',
        },
        take: 6,
      });
    }

    console.log(`✅ 成功获取 ${summaries.length} 个月度汇总`);

    res.json({
      success: true,
      data: month ? summaries[0] : summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('获取月度汇总时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取汇总失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取单个月度汇总
 * GET /api/monthly-summaries/:id
 */
export async function getMonthlySummaryById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const summary = await prisma.monthlySummary.findUnique({
      where: { id },
      include: {
        plot: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: '汇总不存在',
      });
    }

    console.log(`✅ 成功获取月度汇总: ${summary.yearMonth}`);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('获取汇总详情时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取汇总详情失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 创建月度汇总
 * POST /api/monthly-summaries
 */
export async function createMonthlySummary(req: Request, res: Response) {
  try {
    const summaryData = req.body;

    if (!summaryData.year_month) {
      return res.status(400).json({
        success: false,
        message: '年月标识不能为空',
      });
    }

    // 检查是否已存在该月份的汇总
    const existingSummary = await prisma.monthlySummary.findUnique({
      where: {
        yearMonth: summaryData.year_month,
      },
    });

    if (existingSummary) {
      return res.status(400).json({
        success: false,
        message: `${summaryData.year_month} 的汇总已存在，请使用更新功能`,
      });
    }

    // 创建新汇总
    const newSummary = await prisma.monthlySummary.create({
      data: {
        yearMonth: summaryData.year_month,
        plotId: summaryData.plot_id || null,
        detailGallery: summaryData.detail_gallery || null,
        harvestStats: summaryData.harvest_stats || null,
        farmCalendar: summaryData.farm_calendar || null,
        abnormalSummary: summaryData.abnormal_summary || null,
        climateSummary: summaryData.climate_summary || null,
        nextMonthPlan: summaryData.next_month_plan || null,
      },
    });

    console.log(`✅ 成功创建月度汇总: ${newSummary.yearMonth}`);

    res.status(201).json({
      success: true,
      message: '汇总创建成功',
      data: newSummary,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '该月份的汇总已存在',
      });
    }

    console.error('创建汇总时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '创建汇总失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 更新月度汇总
 * PUT /api/monthly-summaries/:id
 */
export async function updateMonthlySummary(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const summaryData = req.body;

    const summary = await prisma.monthlySummary.update({
      where: { id },
      data: {
        plotId: summaryData.plot_id !== undefined ? summaryData.plot_id || null : undefined,
        detailGallery: summaryData.detail_gallery !== undefined ? summaryData.detail_gallery || null : undefined,
        harvestStats: summaryData.harvest_stats !== undefined ? summaryData.harvest_stats || null : undefined,
        farmCalendar: summaryData.farm_calendar !== undefined ? summaryData.farm_calendar || null : undefined,
        abnormalSummary:
          summaryData.abnormal_summary !== undefined ? summaryData.abnormal_summary || null : undefined,
        climateSummary:
          summaryData.climate_summary !== undefined ? summaryData.climate_summary || null : undefined,
        nextMonthPlan: summaryData.next_month_plan !== undefined ? summaryData.next_month_plan || null : undefined,
      },
      include: {
        plot: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`✅ 成功更新月度汇总: ${summary.yearMonth}`);
    console.log(
      `   - 采摘统计: ${(summary.harvestStats as any)?.count || 0}次 / ${(summary.harvestStats as any)?.total_weight || 0}kg`,
    );
    console.log(`   - 异常事件: ${Array.isArray(summary.abnormalSummary) ? summary.abnormalSummary.length : 0}个`);

    res.json({
      success: true,
      message: '汇总更新成功',
      data: summary,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '汇总不存在',
      });
    }

    console.error('更新汇总时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '更新汇总失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除月度汇总
 * DELETE /api/monthly-summaries/:id
 */
export async function deleteMonthlySummary(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const summary = await prisma.monthlySummary.delete({
      where: { id },
    });

    console.log(`✅ 成功删除月度汇总: ${summary.yearMonth}`);

    res.json({
      success: true,
      message: '汇总删除成功',
      data: summary,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '汇总不存在',
      });
    }

    console.error('删除汇总时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '删除汇总失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 获取所有月度总结列表
 * GET /api/summaries
 */
export async function getAllSummaries(req: Request, res: Response) {
  try {
    const summaries = await prisma.monthlySummary.findMany({
      include: {
        plot: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        yearMonth: 'desc',
      },
    });

    console.log(`✅ 成功获取 ${summaries.length} 个月度总结列表`);

    res.json({
      success: true,
      data: summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('获取月度总结列表时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 自动生成/刷新月度汇总
 * POST /api/summaries/generate
 */
export async function generateMonthlySummary(req: Request, res: Response) {
  try {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '请提供正确的月份格式（YYYY-MM）',
      });
    }

    console.log(`🔄 开始生成月度汇总: ${month}`);

    // 1. 查询该月份的所有每日日志
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const dailyLogs = await prisma.dailyGrowthLog.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (!dailyLogs || dailyLogs.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${month} 月份暂无每日日志数据，无法生成汇总`,
      });
    }

    // 2. 聚合统计：采摘数据（从采摘记录中读取）
    const harvestRecords = await prisma.harvestRecord.findMany({
      where: {
        harvestDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        harvestDate: 'asc',
      },
    });

    const harvestStats = {
      count: harvestRecords.length,
      total_weight: harvestRecords.reduce((sum, record) => sum + Number(record.freshLeafWeightKg), 0),
    };

    console.log(`📊 采摘统计 [${month}]:`);
    console.log(`   - 采摘次数: ${harvestStats.count}次`);
    console.log(`   - 总重量: ${harvestStats.total_weight}kg`);

    // 3. 聚合统计：农事日历
    const farmActivities = dailyLogs
      .filter((log) => log.farmActivityType && log.farmActivityType !== 'NONE')
      .map((log) => {
        const date = new Date(log.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
        const activityType = log.farmActivityType;
        const activityMap: Record<string, string> = {
          FERTILIZE: '施肥',
          PRUNE: '修剪',
          IRRIGATE: '灌溉',
          HARVEST: '采摘',
          ABNORMAL: '异常',
        };
        const activity = activityMap[activityType] || activityType;
        return { date: new Date(log.date), text: `${date}日 ${activity}` };
      });

    // 添加采摘记录到农事日历
    const harvestActivities = harvestRecords.map((record) => {
      const date = new Date(record.harvestDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
      return { date: new Date(record.harvestDate), text: `${date}日 采摘` };
    });

    // 合并所有农事活动并按日期排序
    const allActivities = [...farmActivities, ...harvestActivities]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => item.text);

    const farmCalendar = allActivities.join('\n');

    // 4. 聚合统计：异常事件汇总
    const abnormalSummary = dailyLogs
      .filter((log) => {
        const abnormalEvent = log.abnormalEvent as any;
        return abnormalEvent && abnormalEvent.title && String(abnormalEvent.title).trim() !== '';
      })
      .map((log) => {
        const abnormalEvent = log.abnormalEvent as any;
        return {
          date: new Date(log.date).toLocaleDateString('zh-CN'),
          issue: abnormalEvent.title || '',
          measures: abnormalEvent.measures_taken || '',
        };
      });

    console.log(`✅ 找到 ${abnormalSummary.length} 个异常事件`);

    // 5. 聚合统计：气候数据
    const logsWithTemp = dailyLogs.filter((log) => {
      const envData = log.environmentData as any;
      return envData && envData.temperature;
    });

    let avgTemp = '';
    if (logsWithTemp.length > 0) {
      const firstTemp = (logsWithTemp[0].environmentData as any).temperature;
      const lastTemp = (logsWithTemp[logsWithTemp.length - 1].environmentData as any).temperature;
      avgTemp = `${firstTemp}~${lastTemp}`;
    }

    // 降水统计
    const logsWithRainfall = dailyLogs.filter((log) => {
      const envData = log.environmentData as any;
      return envData && envData.rainfall !== undefined && envData.rainfall !== null && envData.rainfall !== '';
    });

    let totalPrecipitation = '无降水记录';
    if (logsWithRainfall.length > 0) {
      const rainfallSum = logsWithRainfall.reduce((sum, log) => {
        const rainfall = (log.environmentData as any).rainfall;
        let value = 0;

        if (typeof rainfall === 'number') {
          value = rainfall;
        } else if (typeof rainfall === 'string') {
          const numericValue = parseFloat(rainfall.replace(/[^\d.-]/g, ''));
          value = isNaN(numericValue) ? 0 : numericValue;
        }

        return sum + value;
      }, 0);

      totalPrecipitation = `${rainfallSum.toFixed(1)}mm`;
    }

    // 6. 顶部影像画廊（由管理员手动上传管理）
    const detailGallery: any[] = [];

    // 7. 获取第一个日志的地块ID
    const plotId = dailyLogs[0].plotId;

    // 8. 构建汇总数据
    const summaryData = {
      yearMonth: month,
      plotId: plotId,
      detailGallery: detailGallery,
      harvestStats: harvestStats,
      farmCalendar: farmCalendar,
      abnormalSummary: abnormalSummary,
      climateSummary: {
        avg_temp: avgTemp,
        total_precipitation: totalPrecipitation,
      },
      nextMonthPlan: [],
    };

    // 9. 使用 upsert 创建或更新汇总
    const summary = await prisma.monthlySummary.upsert({
      where: {
        yearMonth: month,
      },
      update: summaryData,
      create: summaryData,
      include: {
        plot: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`✅ 成功生成/更新月度汇总: ${month}`);
    console.log(`   - 采摘次数: ${harvestStats.count}次`);
    console.log(`   - 总重量: ${harvestStats.total_weight}kg`);
    console.log(`   - 农事活动: ${allActivities.length}项 (包含 ${harvestRecords.length} 次采摘)`);
    console.log(`   - 异常事件: ${abnormalSummary.length}个`);
    console.log(`   - 总降水量: ${totalPrecipitation}`);

    res.json({
      success: true,
      message: '月度汇总生成成功',
      data: summary,
    });
  } catch (error) {
    console.error('生成月度汇总时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '生成月度汇总失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

