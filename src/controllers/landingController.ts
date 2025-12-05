import type { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ======================
// 地块 (Plots) 相关 API
// ======================

/**
 * 获取所有地块信息
 * GET /api/plots
 */
export async function getAllPlots(req: Request, res: Response) {
  try {
    const plots = await prisma.plot.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 将字段转换为与旧版落地页前端一致的命名，避免 undefined.length 报错
    const normalizedPlots = plots.map((plot) => {
      const carouselImages = Array.isArray(plot.carouselImages) ? (plot.carouselImages as string[]) : [];
      const infoList = Array.isArray(plot.infoList) ? (plot.infoList as Record<string, unknown>[]) : [];

      return {
        ...plot,
        _id: plot.id,
        carousel_images: carouselImages,
        info_list: infoList,
        categories: [],
      };
    });

    console.log(`✅ 成功获取 ${normalizedPlots.length} 个地块信息`);

    res.json({
      success: true,
      data: normalizedPlots,
      count: normalizedPlots.length,
    });
  } catch (error) {
    console.error('获取地块信息时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取地块信息失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 创建新地块
 * POST /api/plots
 */
export async function createPlot(req: Request, res: Response) {
  try {
    const { name, carousel_images = [], info_list = [] } = req.body;

    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '地块名称不能为空',
      });
    }

    // 检查地块名称是否已存在
    const existingPlot = await prisma.plot.findUnique({
      where: { name: name.trim() },
    });
    if (existingPlot) {
      return res.status(400).json({
        success: false,
        message: '地块名称已存在，请使用其他名称',
      });
    }

    // 创建新地块
    const newPlot = await prisma.plot.create({
      data: {
        name: name.trim(),
        carouselImages: Array.isArray(carousel_images) ? carousel_images : [],
        infoList: Array.isArray(info_list) ? info_list : [],
      },
    });

    console.log(`✅ 成功创建地块: ${newPlot.name}`);

    res.status(201).json({
      success: true,
      message: '地块创建成功',
      data: newPlot,
    });
  } catch (error: any) {
    console.error('创建地块时发生错误:', error);

    // 处理 Prisma 唯一性约束错误
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: '地块名称已存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '创建地块失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 添加地块轮播图片
 * POST /api/plots/:id/images
 */
export async function addPlotImage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { image_url } = req.body;

    // 验证输入
    if (!image_url || !image_url.trim()) {
      return res.status(400).json({
        success: false,
        message: '图片URL不能为空',
      });
    }

    // 验证URL格式
    try {
      new URL(image_url.trim());
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的图片URL格式',
      });
    }

    // 查找地块
    const plot = await prisma.plot.findUnique({
      where: { id },
    });
    if (!plot) {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    // 获取当前轮播图数组
    const currentImages = Array.isArray(plot.carouselImages) ? (plot.carouselImages as string[]) : [];

    // 检查图片是否已存在
    if (currentImages.includes(image_url.trim())) {
      return res.status(400).json({
        success: false,
        message: '该图片已存在于轮播图中',
      });
    }

    // 添加图片
    const updatedImages = [...currentImages, image_url.trim()];

    const updatedPlot = await prisma.plot.update({
      where: { id },
      data: {
        carouselImages: updatedImages,
      },
    });

    console.log(`✅ 成功为地块 "${plot.name}" 添加轮播图片`);

    res.json({
      success: true,
      message: '轮播图片添加成功',
      data: updatedPlot,
    });
  } catch (error: any) {
    console.error('添加轮播图片时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '添加轮播图片失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除地块轮播图片
 * DELETE /api/plots/:id/images
 */
export async function deletePlotImage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { image_url } = req.body;

    // 验证输入
    if (!image_url || !image_url.trim()) {
      return res.status(400).json({
        success: false,
        message: '请指定要删除的图片URL',
      });
    }

    // 查找地块
    const plot = await prisma.plot.findUnique({
      where: { id },
    });
    if (!plot) {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    // 获取当前轮播图数组
    const currentImages = Array.isArray(plot.carouselImages) ? (plot.carouselImages as string[]) : [];

    // 检查图片是否存在
    if (!currentImages.includes(image_url.trim())) {
      return res.status(404).json({
        success: false,
        message: '指定的图片不存在于轮播图中',
      });
    }

    // 删除图片
    const updatedImages = currentImages.filter((img) => img !== image_url.trim());

    const updatedPlot = await prisma.plot.update({
      where: { id },
      data: {
        carouselImages: updatedImages,
      },
    });

    console.log(`✅ 成功从地块 "${plot.name}" 删除轮播图片`);

    res.json({
      success: true,
      message: '轮播图片删除成功',
      data: updatedPlot,
    });
  } catch (error: any) {
    console.error('删除轮播图片时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除轮播图片失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 更新地块核心信息列表
 * PUT /api/plots/:id/info
 */
export async function updatePlotInfo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { info_list } = req.body;

    // 验证输入
    if (!Array.isArray(info_list)) {
      return res.status(400).json({
        success: false,
        message: '核心信息列表必须是数组格式',
      });
    }

    // 验证信息项格式 - 至少图标、标签或值中有一个不为空
    for (let i = 0; i < info_list.length; i++) {
      const item = info_list[i];
      if (!item.icon && !item.label && !item.value) {
        return res.status(400).json({
          success: false,
          message: `第 ${i + 1} 个信息项的图标、标签或值至少需要填写一个`,
        });
      }
    }

    // 查找并更新地块
    const plot = await prisma.plot.update({
      where: { id },
      data: {
        infoList: info_list,
      },
    });

    console.log(`✅ 成功更新地块 "${plot.name}" 的核心信息列表`);

    res.json({
      success: true,
      message: '核心信息列表更新成功',
      data: plot,
    });
  } catch (error: any) {
    console.error('更新核心信息列表时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新核心信息列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 更新地块轮播图
 * PUT /api/plots/:id/carousel
 */
export async function updatePlotCarousel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { carousel_images } = req.body;

    // 验证输入
    if (!Array.isArray(carousel_images)) {
      return res.status(400).json({
        success: false,
        message: '轮播图片列表必须是数组格式',
      });
    }

    // 验证每个URL的格式（可选，因为可能包含相对路径）
    for (let i = 0; i < carousel_images.length; i++) {
      const url = carousel_images[i];
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          message: `第 ${i + 1} 个图片URL格式不正确`,
        });
      }
    }

    // 查找并更新地块
    const plot = await prisma.plot.update({
      where: { id },
      data: {
        carouselImages: carousel_images,
      },
    });

    console.log(`✅ 成功更新地块 "${plot.name}" 的轮播图 (${carousel_images.length} 张图片)`);

    res.json({
      success: true,
      message: '轮播图更新成功',
      data: plot,
    });
  } catch (error: any) {
    console.error('更新轮播图时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '更新轮播图失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 删除地块
 * DELETE /api/plots/:id
 */
export async function deletePlot(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 查找并删除地块
    const plot = await prisma.plot.delete({
      where: { id },
    });

    console.log(`✅ 成功删除地块: ${plot.name}`);

    res.json({
      success: true,
      message: '地块删除成功',
      data: plot,
    });
  } catch (error: any) {
    console.error('删除地块时发生错误:', error);

    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '地块不存在',
      });
    }

    res.status(500).json({
      success: false,
      message: '删除地块失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 设置 (Settings) 相关 API
// ======================

/**
 * 获取所有设置信息
 * GET /api/settings
 */
export async function getAllSettings(req: Request, res: Response) {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });

    console.log(`✅ 成功获取 ${settings.length} 个设置项`);

    res.json({
      success: true,
      data: settings,
      count: settings.length,
    });
  } catch (error) {
    console.error('获取设置信息时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设置信息失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 获取CTA背景图设置
 * GET /api/settings/cta-background
 */
export async function getCTABackground(req: Request, res: Response) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'cta_background_image' },
    });

    console.log(`✅ 成功获取CTA背景图设置`);

    res.json({
      success: true,
      data:
        setting ||
        ({
          key: 'cta_background_image',
          value: '',
          description: '',
        } as any),
    });
  } catch (error) {
    console.error('获取CTA背景图设置时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取背景图设置失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 设置CTA背景图
 * POST /api/settings/cta-background
 */
export async function setCTABackground(req: Request, res: Response) {
  try {
    const { value, description } = req.body;

    // 验证输入
    if (!value || !value.trim()) {
      return res.status(400).json({
        success: false,
        message: '背景图URL不能为空',
      });
    }

    // 验证URL格式
    try {
      new URL(value.trim());
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的图片URL格式',
      });
    }

    // 使用 upsert 创建或更新设置
    const setting = await prisma.setting.upsert({
      where: { key: 'cta_background_image' },
      update: {
        value: value.trim(),
        description: description ? description.trim() : '云养茶园CTA区域背景图',
        category: 'ui',
        dataType: 'url',
        isPublic: true,
      },
      create: {
        key: 'cta_background_image',
        value: value.trim(),
        description: description ? description.trim() : '云养茶园CTA区域背景图',
        category: 'ui',
        dataType: 'url',
        isPublic: true,
      },
    });

    console.log(`✅ 成功设置CTA背景图: ${setting.value}`);

    res.json({
      success: true,
      message: 'CTA背景图设置成功',
      data: setting,
    });
  } catch (error: any) {
    console.error('设置CTA背景图时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '设置背景图失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

/**
 * 获取所有页脚设置
 * GET /api/settings/footer
 */
export async function getFooterSettings(req: Request, res: Response) {
  try {
    // 定义需要查询的所有页脚相关的 key
    const footerKeys = ['footer_logo_url', 'footer_garden_name', 'footer_copyright_text', 'social_links'];

    // 一次性查询所有相关设置
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: footerKeys,
        },
      },
    });

    // 构建返回对象，提供默认值
    const footerData: {
      logoUrl: string;
      gardenName: string;
      copyrightText: string;
      socialLinks: any[];
    } = {
      logoUrl: '',
      gardenName: '',
      copyrightText: '',
      socialLinks: [],
    };

    // 处理查询结果
    settings.forEach((setting) => {
      switch (setting.key) {
        case 'footer_logo_url':
          footerData.logoUrl = setting.value || '';
          break;
        case 'footer_garden_name':
          footerData.gardenName = setting.value || '';
          break;
        case 'footer_copyright_text':
          footerData.copyrightText = setting.value || '';
          break;
        case 'social_links':
          // 解析社交链接 JSON 字符串
          try {
            if (setting.value) {
              footerData.socialLinks = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
            }
          } catch (parseError) {
            console.error('解析社交链接 JSON 时出错:', parseError);
            footerData.socialLinks = [];
          }
          break;
      }
    });

    console.log(`✅ 成功获取页脚设置，包含 ${footerData.socialLinks.length} 个社交链接`);

    res.json({
      success: true,
      data: footerData,
    });
  } catch (error) {
    console.error('获取页脚设置时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '获取页脚设置失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 保存所有页脚设置
 * POST /api/settings/footer
 */
export async function saveFooterSettings(req: Request, res: Response) {
  try {
    const { logoUrl, gardenName, copyrightText, socialLinks } = req.body;

    // 验证社交链接数据格式
    if (socialLinks && !Array.isArray(socialLinks)) {
      return res.status(400).json({
        success: false,
        message: '社交链接必须是数组格式',
      });
    }

    // 验证社交链接中每个对象的格式
    if (socialLinks && socialLinks.length > 0) {
      for (let i = 0; i < socialLinks.length; i++) {
        const link = socialLinks[i];
        if (!link.platform || !link.url) {
          return res.status(400).json({
            success: false,
            message: `第 ${i + 1} 个社交链接缺少必要字段（platform 或 url）`,
          });
        }
      }
    }

    // 构建更新操作数组，使用 Promise.all 并发执行
    const updatePromises = [
      // 更新 Logo URL
      prisma.setting.upsert({
        where: { key: 'footer_logo_url' },
        update: {
          value: logoUrl || '',
          description: '页脚 Logo 图片 URL',
          category: 'footer',
          dataType: 'url',
          isPublic: true,
        },
        create: {
          key: 'footer_logo_url',
          value: logoUrl || '',
          description: '页脚 Logo 图片 URL',
          category: 'footer',
          dataType: 'url',
          isPublic: true,
        },
      }),

      // 更新茶园名称
      prisma.setting.upsert({
        where: { key: 'footer_garden_name' },
        update: {
          value: gardenName || '',
          description: '页脚茶园名称',
          category: 'footer',
          dataType: 'text',
          isPublic: true,
        },
        create: {
          key: 'footer_garden_name',
          value: gardenName || '',
          description: '页脚茶园名称',
          category: 'footer',
          dataType: 'text',
          isPublic: true,
        },
      }),

      // 更新版权信息
      prisma.setting.upsert({
        where: { key: 'footer_copyright_text' },
        update: {
          value: copyrightText || '',
          description: '页脚版权信息文本',
          category: 'footer',
          dataType: 'text',
          isPublic: true,
        },
        create: {
          key: 'footer_copyright_text',
          value: copyrightText || '',
          description: '页脚版权信息文本',
          category: 'footer',
          dataType: 'text',
          isPublic: true,
        },
      }),

      // 更新社交链接（转为 JSON 字符串）
      prisma.setting.upsert({
        where: { key: 'social_links' },
        update: {
          value: JSON.stringify(socialLinks || []),
          description: '页脚社交媒体链接列表',
          category: 'footer',
          dataType: 'json',
          isPublic: true,
        },
        create: {
          key: 'social_links',
          value: JSON.stringify(socialLinks || []),
          description: '页脚社交媒体链接列表',
          category: 'footer',
          dataType: 'json',
          isPublic: true,
        },
      }),
    ];

    // 并发执行所有更新操作
    await Promise.all(updatePromises);

    console.log(`✅ 成功保存所有页脚设置`);
    console.log(`   - Logo URL: ${logoUrl ? '已设置' : '未设置'}`);
    console.log(`   - 茶园名称: ${gardenName || '未设置'}`);
    console.log(`   - 版权信息: ${copyrightText || '未设置'}`);
    console.log(`   - 社交链接: ${socialLinks?.length || 0} 个`);

    res.json({
      success: true,
      message: '页脚设置保存成功',
    });
  } catch (error: any) {
    console.error('保存页脚设置时发生错误:', error);

    res.status(500).json({
      success: false,
      message: '保存页脚设置失败',
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    });
  }
}

// ======================
// 公开 API (无需登录)
// ======================

/**
 * 获取落地页所需的全部聚合数据
 * GET /api/public/landing-page
 */
export async function getPublicLandingPage(req: Request, res: Response) {
  try {
    // 1. 获取地块数据 (假设我们只管理一个地块，所以用 findFirst)
    const plotData = await prisma.plot.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. 获取所有品类数据（按 sort_order 排序）
    const categoryData = await prisma.teaCategory.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // 3. 获取云养茶园背景图
    const ctaBackground = await prisma.setting.findUnique({
      where: { key: 'cta_background_image' },
    });

    // 4. 获取所有页脚相关设置
    const footerKeys = ['footer_logo_url', 'footer_garden_name', 'footer_copyright_text', 'social_links'];
    const footerSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: footerKeys,
        },
      },
    });

    // 构建页脚数据对象
    const footer: {
      logoUrl: string;
      gardenName: string;
      copyrightText: string;
      socialLinks: any[];
    } = {
      logoUrl: '',
      gardenName: '',
      copyrightText: '',
      socialLinks: [],
    };

    // 处理页脚设置
    footerSettings.forEach((setting) => {
      switch (setting.key) {
        case 'footer_logo_url':
          footer.logoUrl = setting.value || '';
          break;
        case 'footer_garden_name':
          footer.gardenName = setting.value || '';
          break;
        case 'footer_copyright_text':
          footer.copyrightText = setting.value || '';
          break;
        case 'social_links':
          try {
            if (setting.value) {
              footer.socialLinks = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
            }
          } catch (parseError) {
            console.error('解析社交链接 JSON 数据时出错:', parseError);
            footer.socialLinks = [];
          }
          break;
      }
    });

    // 5. 将所有数据整合成一个对象
    const landingPageData = {
      plot: plotData,
      categories: categoryData,
      cta_bg: ctaBackground ? ctaBackground.value : null,
      footer: footer, // 统一的页脚数据对象
    };

    // 6. 以 JSON 格式成功返回给前端
    res.status(200).json(landingPageData);

    console.log(`✅ 公开落地页数据已发送`);
    console.log(`   - 页脚 Logo: ${footer.logoUrl ? '已设置' : '未设置'}`);
    console.log(`   - 茶园名称: ${footer.gardenName || '未设置'}`);
    console.log(`   - 社交链接: ${footer.socialLinks.length} 个`);
  } catch (error) {
    // 如果在查询数据库时发生任何错误，打印日志并返回 500 错误
    console.error('获取公开落地页数据时出错:', error);
    res.status(500).json({ message: '服务器在获取数据时发生内部错误' });
  }
}

