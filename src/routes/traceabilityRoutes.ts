import { Router } from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  updateBatchProductionSteps,
  updateBatchStepCraft,
  deleteBatch,
} from '../controllers/traceabilityController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

router.post('/', createBatch);
router.get('/', getAllBatches);
router.get('/:id', getBatchById);
router.put('/:id', updateBatch);
router.put('/:id/production-steps', updateBatchProductionSteps);
router.put('/:batchId/steps/:stepIndex/:craftType', updateBatchStepCraft);
router.delete('/:id', deleteBatch);

export default router;

