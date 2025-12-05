import { Router } from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reclassifyHarvestRecords,
} from '../controllers/categoryController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 获取所有品类
router.get('/', getAllCategories);

// 创建新品类
router.post('/', createCategory);

// 更新品类
router.put('/:id', updateCategory);

// 删除品类
router.delete('/:id', deleteCategory);

// 重新归类采摘记录
router.post('/reclassify-harvest-records', reclassifyHarvestRecords);

export default router;

