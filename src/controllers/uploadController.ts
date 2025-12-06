import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../config/paths';

// 上传目录配置
const uploadDir = UPLOADS_DIR;

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 上传分类配置
const uploadCategories = {
  avatars: 'avatars',
  personnel: 'personnel',
  growth: 'growth',
  harvest: 'harvest',
  production: 'production',
  products: 'products',
  landing: 'landing',
  monthly: 'monthly',
  weather: 'weather',
  misc: 'misc',
};

// 确保所有子目录存在
Object.values(uploadCategories).forEach((category) => {
  const categoryDir = path.join(uploadDir, category);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
    console.log(`✅ 创建上传目录: ${category}`);
  }
});

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = (req.body.category as string) || 'misc';
    const validCategory = uploadCategories[category as keyof typeof uploadCategories] || uploadCategories.misc;
    const targetDir = path.join(uploadDir, validCategory);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP, AVIF, SVG) 或视频文件 (MP4, WebM, OGG, MOV)');
    cb(error as any, false);
  }
};

// multer 配置
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: fileFilter,
});

/**
 * 通用文件上传接口
 * POST /api/upload
 */
export async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件',
      });
    }

    const category = (req.body.category as string) || 'misc';
    const validCategory = uploadCategories[category as keyof typeof uploadCategories] || uploadCategories.misc;

    const fileUrl = `/uploads/${validCategory}/${req.file.filename}`;

    console.log(`✅ 文件上传成功: ${validCategory}/${req.file.filename}`);

    res.json({
      success: true,
      message: '文件上传成功',
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      category: validCategory,
    });
  } catch (error) {
    console.error('文件上传时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 上传图片文件接口
 * POST /api/upload-image
 */
export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的图片文件',
      });
    }

    const category = (req.body.category as string) || 'misc';
    const validCategory = uploadCategories[category as keyof typeof uploadCategories] || uploadCategories.misc;

    const imageUrl = `/uploads/${validCategory}/${req.file.filename}`;
    
    // 生成完整URL：优先使用环境变量，否则从请求头获取
    let fullUrl: string;
    if (process.env.BASE_URL) {
      // 使用环境变量中的基础URL（去除末尾斜杠）
      fullUrl = `${process.env.BASE_URL.replace(/\/$/, '')}${imageUrl}`;
    } else {
      // 自动推断：从请求头动态拼接
      // 协议：优先读取 x-forwarded-proto（兼容 Nginx 反向代理），否则使用 req.protocol
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
      // 主机：使用 req.get('host')
      const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
      fullUrl = `${protocol}://${host}${imageUrl}`;
    }

    console.log(`✅ 图片上传成功: ${validCategory}/${req.file.filename}`);

    res.json({
      success: true,
      message: '图片上传成功',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: imageUrl,
        fullUrl: fullUrl,
        category: validCategory,
      },
    });
  } catch (error) {
    console.error('图片上传时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '图片上传失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * 上传天气图标SVG
 * POST /api/weather-templates/upload-icon
 */
export async function uploadWeatherIcon(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的SVG文件',
      });
    }

    // 验证文件类型
    if (req.file.mimetype !== 'image/svg+xml') {
      return res.status(400).json({
        success: false,
        message: '只允许上传SVG格式的图标文件',
      });
    }

    const weatherDir = path.join(uploadDir, 'weather');
    const actualPath = req.file.path;

    // 安全检查：确保文件确实保存在weather目录中
    if (!actualPath.includes(path.join('uploads', 'weather'))) {
      return res.status(400).json({
        success: false,
        message: '文件保存路径不正确',
      });
    }

    const fileUrl = `/uploads/weather/${req.file.filename}`;

    console.log(`✅ 天气图标上传成功: ${req.file.filename}`);

    res.json({
      success: true,
      message: '天气图标上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        original_name: req.file.originalname,
      },
    });
  } catch (error) {
    console.error('天气图标上传时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '天气图标上传失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : '服务器内部错误',
    });
  }
}

/**
 * Multer 错误处理中间件
 */
export function handleMulterError(error: Error, req: Request, res: Response, next: any) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制（最大50MB）',
      });
    }
    return res.status(400).json({
      success: false,
      message: `文件上传错误: ${error.message}`,
    });
  }

  if (error.message.includes('只允许上传')) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
}

