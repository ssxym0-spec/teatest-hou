import { Router } from 'express';
import {
  getExistingDates,
  getAllGrowthLogs,
  getWeatherByDate,
  getGrowthLogsCount,
  getGrowthLogById,
  createGrowthLog,
  updateGrowthLog,
  deleteGrowthLog,
} from '../controllers/growthController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 注意：这些路由必须放在 /:id 之前，否则会被误识别为 id 参数
router.get('/existing-dates', getExistingDates);
router.get('/by-date', getWeatherByDate);
router.get('/count', getGrowthLogsCount);

// CRUD 路由
router.get('/', getAllGrowthLogs);
router.get('/:id', getGrowthLogById);
router.post('/', createGrowthLog);
router.put('/:id', updateGrowthLog);
router.delete('/:id', deleteGrowthLog);

export default router;

