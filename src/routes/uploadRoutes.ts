import { Router } from 'express';
import { upload, uploadFile, uploadImage, uploadWeatherIcon, handleMulterError } from '../controllers/uploadController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 通用文件上传
router.post('/upload', upload.single('media'), uploadFile);

// 图片上传
router.post('/upload-image', upload.single('image'), uploadImage);

// 天气图标上传（SVG专用）
router.post('/weather-templates/upload-icon', upload.single('svg_file'), uploadWeatherIcon);

// Multer 错误处理
router.use(handleMulterError);

export default router;

