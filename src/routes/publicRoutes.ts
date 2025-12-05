import { Router } from 'express';
import {
  getPublicGrowthData,
  getPublicMonthlySummary,
  getPublicCategories,
  getPublicWeatherTemplates,
  getPublicBatches,
  getPublicBatchById,
  getPublicBatchesByCategorySlug,
  getPublicAdoptionPlans,
} from '../controllers/publicController';

const router = Router();

// 所有公开API路由都不需要登录
router.get('/growth-data', getPublicGrowthData);
router.get('/monthly-summary', getPublicMonthlySummary);
router.get('/categories', getPublicCategories);
router.get('/categories/:slug/batches', getPublicBatchesByCategorySlug);
router.get('/weather-templates', getPublicWeatherTemplates);
router.get('/batches', getPublicBatches);
router.get('/batches/:id', getPublicBatchById);
router.get('/adoption-plans', getPublicAdoptionPlans);

export default router;

