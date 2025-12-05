import { Router } from 'express';
import {
  createHarvestRecord,
  getAllHarvestRecords,
  getUnassignedHarvestRecords,
  getHarvestRecordById,
  updateHarvestRecord,
  deleteHarvestRecord,
  syncHarvestRecordsWeather,
} from '../controllers/harvestController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

router.post('/', createHarvestRecord);
router.get('/', getAllHarvestRecords);
router.get('/unassigned', getUnassignedHarvestRecords);
router.get('/:id', getHarvestRecordById);
router.put('/:id', updateHarvestRecord);
router.delete('/:id', deleteHarvestRecord);
router.post('/sync-weather', syncHarvestRecordsWeather);

export default router;

