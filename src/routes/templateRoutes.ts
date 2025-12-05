import { Router } from 'express';
import {
  getAllStepTemplates,
  updateStepTemplate,
  getAllTitleTemplates,
  updateTitleTemplates,
  getAllAppreciationTemplates,
  updateAppreciationTemplate,
  deleteAppreciationTemplate,
} from '../controllers/templateController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 制作步骤模板
router.get('/step-templates', getAllStepTemplates);
router.put('/step-templates/:stepName', updateStepTemplate);

// 批次详情标题模板
router.get('/title-templates', getAllTitleTemplates);
router.post('/title-templates', updateTitleTemplates);

// 鉴赏模板
router.get('/appreciation-templates', getAllAppreciationTemplates);
router.put('/appreciation-templates/:categoryName', updateAppreciationTemplate);
router.delete('/appreciation-templates/:categoryName', deleteAppreciationTemplate);

export default router;

