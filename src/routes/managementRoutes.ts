import { Router } from 'express';
import {
  getAllGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  getAllPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
  getAllWeatherTemplates,
  createWeatherTemplate,
  updateWeatherTemplate,
  deleteWeatherTemplate,
  getAdoptionPlan,
  updateAdoptionPlan,
  getUser,
} from '../controllers/managementController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// 所有路由都需要登录
router.use(requireLogin);

// 等级管理
router.get('/grades', getAllGrades);
router.post('/grades', createGrade);
router.put('/grades/:id', updateGrade);
router.delete('/grades/:id', deleteGrade);

// 人员管理
router.get('/personnel', getAllPersonnel);
router.post('/personnel', createPersonnel);
router.put('/personnel/:id', updatePersonnel);
router.delete('/personnel/:id', deletePersonnel);

// 天气模板管理
router.get('/weather-templates', getAllWeatherTemplates);
router.post('/weather-templates', createWeatherTemplate);
router.put('/weather-templates/:id', updateWeatherTemplate);
router.delete('/weather-templates/:id', deleteWeatherTemplate);

// 云养茶园方案
router.get('/adoption-plans/:type', getAdoptionPlan);
router.put('/adoption-plans/:type', updateAdoptionPlan);

// 用户信息
router.get('/user', getUser);

export default router;

