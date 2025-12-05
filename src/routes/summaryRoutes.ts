import { Router } from 'express';
import {
  getAllMonthlySummaries,
  getMonthlySummaryById,
  createMonthlySummary,
  updateMonthlySummary,
  deleteMonthlySummary,
  getAllSummaries,
  generateMonthlySummary,
} from '../controllers/summaryController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 月度汇总 CRUD
router.get('/monthly-summaries', getAllMonthlySummaries);
router.get('/monthly-summaries/:id', getMonthlySummaryById);
router.post('/monthly-summaries', createMonthlySummary);
router.put('/monthly-summaries/:id', updateMonthlySummary);
router.delete('/monthly-summaries/:id', deleteMonthlySummary);

// 月度总结列表和生成
router.get('/summaries', getAllSummaries);
router.post('/summaries/generate', generateMonthlySummary);

export default router;

