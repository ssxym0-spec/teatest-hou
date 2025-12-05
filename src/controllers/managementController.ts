import type { Request, Response } from 'express';
import type { PersonnelRole, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

// ======================
// 等级管理 (Grades)
// ======================

export async function getAllGrades(req: Request, res: Response) {
  try {
    const grades = await prisma.grade.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ 成功获取 ${grades.length} 个产品等级`);

    res.json({
      success: true,
      data: grades,
      count: grades.length,
    });
  } catch (error) {
    console.error('获取产品等级时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取等级失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

export async function createGrade(req: Request, res: Response) {
  try {
    const { name, badge_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '等级名称不能为空',
      });
    }

    const newGrade = await prisma.grade.create({
      data: {
        name: name.trim(),
        badgeUrl: badge_url || null,
      },
    });

    console.log(`✅ 成功创建新等级: ${newGrade.name}`);

    res.json({
      success: true,
      message: '等级创建成功',
      data: newGrade,
    });
  } catch (error: any) {
    console.error('创建等级时发生错误:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '该等级名称已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '创建等级失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function updateGrade(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, badge_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '等级名称不能为空',
      });
    }

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        name: name.trim(),
        badgeUrl: badge_url !== undefined ? badge_url : undefined,
      },
    });

    console.log(`✅ 成功更新等级: ${grade.name}`);

    res.json({
      success: true,
      message: '等级更新成功',
      data: grade,
    });
  } catch (error: any) {
    console.error('更新等级时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '等级不存在',
      });
    }

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '该等级名称已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新等级失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function deleteGrade(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const grade = await prisma.grade.delete({
      where: { id },
    });

    console.log(`✅ 成功删除等级: ${grade.name}`);

    res.json({
      success: true,
      message: '等级删除成功',
    });
  } catch (error: any) {
    console.error('删除等级时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '等级不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除等级失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 人员管理 (Personnel)
// ======================

const PERSONNEL_ROLE_MAP: Record<string, PersonnelRole> = {
  记录人: 'RECORDER',
  采摘队长: 'HARVEST_LEAD',
  制茶师: 'TEA_MASTER',
  recorder: 'RECORDER',
  harvest_lead: 'HARVEST_LEAD',
  tea_master: 'TEA_MASTER',
  RECORDER: 'RECORDER',
  HARVEST_LEAD: 'HARVEST_LEAD',
  TEA_MASTER: 'TEA_MASTER',
};

export async function getAllPersonnel(req: Request, res: Response) {
  const { role } = req.query;
  console.log('🚀 [Personnel] 收到获取人员列表请求', {
    role: role ?? 'ALL',
  });

  try {
    const where: Prisma.PersonnelWhereInput = {};

    if (role) {
      const normalizedRole = PERSONNEL_ROLE_MAP[String(role)];
      if (!normalizedRole) {
        console.warn(
          `⚠️ [Personnel] 收到未知角色过滤条件: ${role}, 将默认返回全部人员`,
        );
      } else {
        where.role = normalizedRole;
        console.log(
          `🔍 [Personnel] 按角色过滤: ${role} -> ${normalizedRole}`,
        );
      }
    }

    const personnel = await prisma.personnel.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(
      `✅ [Personnel] 成功从 PostgreSQL 获取 ${personnel.length} 条人员数据`,
    );

    res.json({
      success: true,
      data: personnel,
      count: personnel.length,
    });
  } catch (error) {
    console.error('❌ [Personnel] 获取人员列表时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取人员列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

export async function createPersonnel(req: Request, res: Response) {
  try {
    const { name, avatar_url, role, experience_years } = req.body;

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        message: '人员姓名和角色不能为空',
      });
    }

    const roleMap: Record<string, string> = {
      记录人: 'RECORDER',
      采摘队长: 'HARVEST_LEAD',
      制茶师: 'TEA_MASTER',
      RECORDER: 'RECORDER',
      HARVEST_LEAD: 'HARVEST_LEAD',
      TEA_MASTER: 'TEA_MASTER',
    };
    const normalizedRole = roleMap[role];
    if (!normalizedRole) {
      return res.status(400).json({
        success: false,
        message: '无效的角色类型',
      });
    }

    const personnel = await prisma.personnel.create({
      data: {
        name: name.trim(),
        avatarUrl: avatar_url || null,
        role: normalizedRole as any,
        experienceYears: Math.min(Math.max(Number(experience_years || 0), 0), 100),
      },
    });

    console.log(`✅ 成功新增人员: ${name} (${role})`);

    res.json({
      success: true,
      message: '人员新增成功',
      data: personnel,
    });
  } catch (error: any) {
    console.error('新增人员时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '新增人员失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function updatePersonnel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, avatar_url, role, experience_years } = req.body;

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        message: '人员姓名和角色不能为空',
      });
    }

    const roleMap: Record<string, string> = {
      记录人: 'RECORDER',
      采摘队长: 'HARVEST_LEAD',
      制茶师: 'TEA_MASTER',
      RECORDER: 'RECORDER',
      HARVEST_LEAD: 'HARVEST_LEAD',
      TEA_MASTER: 'TEA_MASTER',
    };
    const normalizedRole = roleMap[role];
    if (!normalizedRole) {
      return res.status(400).json({
        success: false,
        message: '无效的角色类型',
      });
    }

    const personnel = await prisma.personnel.update({
      where: { id },
      data: {
        name: name.trim(),
        avatarUrl: avatar_url !== undefined ? avatar_url : undefined,
        role: normalizedRole as any,
        experienceYears:
          experience_years !== undefined
            ? Math.min(Math.max(Number(experience_years), 0), 100)
            : undefined,
      },
    });

    console.log(`✅ 成功更新人员信息: ${name} (${role})`);

    res.json({
      success: true,
      message: '人员信息更新成功',
      data: personnel,
    });
  } catch (error: any) {
    console.error('更新人员信息时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '人员不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新人员信息失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function deletePersonnel(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const personnel = await prisma.personnel.delete({
      where: { id },
    });

    console.log(`✅ 成功删除人员: ${personnel.name} (${personnel.role})`);

    res.json({
      success: true,
      message: '人员删除成功',
      data: personnel,
    });
  } catch (error: any) {
    console.error('删除人员时发生错误:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '人员不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除人员失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 天气模板管理 (Weather Templates)
// ======================

export async function getAllWeatherTemplates(req: Request, res: Response) {
  try {
    const { active_only } = req.query;

    let weatherTemplates;
    if (active_only === 'true') {
      weatherTemplates = await prisma.weatherTemplate.findMany({
        where: {
          isActive: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      });
    } else {
      weatherTemplates = await prisma.weatherTemplate.findMany({
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      });
    }

    res.json({
      success: true,
      data: weatherTemplates,
      count: weatherTemplates.length,
    });
  } catch (error) {
    console.error('❌ 获取天气模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取天气模板列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

export async function createWeatherTemplate(req: Request, res: Response) {
  try {
    const { name, svg_icon, temperature_range, description, sort_order, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '天气名称不能为空',
      });
    }

    const newWeatherTemplate = await prisma.weatherTemplate.create({
      data: {
        name: name.trim(),
        svgIcon: svg_icon || '',
        temperatureRange: temperature_range || null,
        description: description || null,
        sortOrder: sort_order || 0,
        isActive: is_active !== false,
      },
    });

    res.json({
      success: true,
      message: '天气模板创建成功',
      data: newWeatherTemplate,
    });
  } catch (error: any) {
    console.error('❌ 创建天气模板失败:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '该天气名称已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '创建天气模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function updateWeatherTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, svg_icon, temperature_range, description, sort_order, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '天气名称不能为空',
      });
    }

    const weatherTemplate = await prisma.weatherTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        svgIcon: svg_icon !== undefined ? svg_icon : undefined,
        temperatureRange: temperature_range !== undefined ? temperature_range : undefined,
        description: description !== undefined ? description : undefined,
        sortOrder: sort_order !== undefined ? sort_order : undefined,
        isActive: is_active !== undefined ? is_active : undefined,
      },
    });

    res.json({
      success: true,
      message: '天气模板更新成功',
      data: weatherTemplate,
    });
  } catch (error: any) {
    console.error('❌ 更新天气模板失败:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '天气模板不存在',
      });
    }

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '该天气名称已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新天气模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function deleteWeatherTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const weatherTemplate = await prisma.weatherTemplate.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '天气模板删除成功',
    });
  } catch (error: any) {
    console.error('❌ 删除天气模板失败:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '天气模板不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除天气模板失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 云养茶园方案 (Adoption Plans)
// ======================

function getDefaultAdoptionPlanData(type: string) {
  const defaults: any = {
    private: {
      marketingHeader: { title: '', subtitle: '', description: '' },
      valuePropositions: [],
      customerCases: [],
      scenarioApplications: [],
      packages: [],
      comparisonPackageNames: [],
      comparisonFeatures: [],
      processSteps: [],
    },
    enterprise: {
      marketingHeader: { title: '', subtitle: '', description: '' },
      customerCases: [],
      useScenarios: [],
      serviceContents: [],
      processSteps: [],
    },
    b2b: {
      description: '',
    },
  };
  return defaults[type] || {};
}

export async function getAdoptionPlan(req: Request, res: Response) {
  try {
    const { type } = req.params;

    if (!['private', 'enterprise', 'b2b'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '无效的方案类型，必须是 private、enterprise 或 b2b',
      });
    }

    // URL 使用小写字符串，Prisma 枚举使用大写，需要做一次映射
    const enumTypeMap: Record<string, any> = {
      private: 'PRIVATE',
      enterprise: 'ENTERPRISE',
      b2b: 'B2B',
    };

    const prismaType = enumTypeMap[type];

    let plan = await prisma.adoptionPlan.findUnique({
      where: { type: prismaType },
    });

    if (!plan) {
      const defaultData = getDefaultAdoptionPlanData(type);
      plan = await prisma.adoptionPlan.create({
        data: {
          type: prismaType,
          ...defaultData,
        },
      });
      console.log(`✅ 已自动创建${type}方案的默认数据`);
    }

    res.json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error('获取领养方案失败:', error);
    res.status(500).json({
      success: false,
      message: '获取方案数据失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

export async function updateAdoptionPlan(req: Request, res: Response) {
  try {
    const { type } = req.params;

    if (!['private', 'enterprise', 'b2b'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '无效的方案类型，必须是 private、enterprise 或 b2b',
      });
    }

    let updateData: any = {};

    const enumTypeMap: Record<string, any> = {
      private: 'PRIVATE',
      enterprise: 'ENTERPRISE',
      b2b: 'B2B',
    };
    const prismaType = enumTypeMap[type];

    // 构建更新数据，兼容多种字段名格式
    if (type === 'private') {
      if (req.body.marketing_header !== undefined) updateData.marketingHeader = req.body.marketing_header;
      if (req.body.value_propositions !== undefined) updateData.valuePropositions = req.body.value_propositions;
      if (req.body.customer_cases !== undefined) updateData.customerCases = req.body.customer_cases;
      if (req.body.scenario_applications !== undefined) updateData.scenarioApplications = req.body.scenario_applications;
      if (req.body.packages !== undefined) updateData.packages = req.body.packages;
      if (req.body.process_steps !== undefined) updateData.processSteps = req.body.process_steps;
      if (req.body.comparison_package_names !== undefined) updateData.comparisonPackageNames = req.body.comparison_package_names;
      if (req.body.comparison_features !== undefined) updateData.comparisonFeatures = req.body.comparison_features;
    } else if (type === 'enterprise') {
      if (req.body.marketing_header !== undefined) updateData.marketingHeader = req.body.marketing_header;
      if (req.body.customer_cases !== undefined) updateData.customerCases = req.body.customer_cases;
      if (req.body.use_scenarios !== undefined) updateData.useScenarios = req.body.use_scenarios;
      if (req.body.service_contents !== undefined) updateData.serviceContents = req.body.service_contents;
      if (req.body.process_steps !== undefined) updateData.processSteps = req.body.process_steps;
    } else if (type === 'b2b') {
      if (req.body.description !== undefined) updateData.description = req.body.description;
    }

    // 检查是否有数据需要更新
    if (Object.keys(updateData).length === 0) {
      console.warn(`⚠️ 更新数据为空，跳过数据库操作`);
      return res.status(400).json({
        success: false,
        message: '没有提供需要更新的数据',
      });
    }

    console.log(`📝 准备更新 ${type} 方案，更新字段:`, Object.keys(updateData));

    const updatedPlan = await prisma.adoptionPlan.upsert({
      where: { type: prismaType },
      update: updateData,
      create: {
        type: prismaType,
        ...getDefaultAdoptionPlanData(type),
        ...updateData,
      },
    });

    console.log(`✅ ${type}方案已成功更新到数据库，ID: ${updatedPlan.id}`);

    console.log(`✅ ${type}方案已成功更新`);

    res.json({
      success: true,
      message: '方案保存成功',
      data: updatedPlan,
    });
  } catch (error: any) {
    console.error('❌ 更新领养方案失败:', error);

    res.status(500).json({
      success: false,
      message: '保存方案失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 用户信息 (User)
// ======================

export async function getUser(req: Request, res: Response) {
  if (req.session && req.session.user) {
    res.json({
      success: true,
      user: req.session.user,
    });
  } else {
    res.status(401).json({
      success: false,
      message: '未登录',
    });
  }
}

