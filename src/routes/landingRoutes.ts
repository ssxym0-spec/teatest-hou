import { Router } from 'express';
import {
  getAllPlots,
  createPlot,
  addPlotImage,
  deletePlotImage,
  updatePlotInfo,
  updatePlotCarousel,
  deletePlot,
  getAllSettings,
  getCTABackground,
  setCTABackground,
  getFooterSettings,
  saveFooterSettings,
  getPublicLandingPage,
} from '../controllers/landingController';
import { requireLogin } from '../middleware/auth';

const router = Router();

// ======================
// 地块 (Plots) 路由 - 需要登录
// ======================
router.get('/plots', requireLogin, getAllPlots);
router.post('/plots', requireLogin, createPlot);
router.post('/plots/:id/images', requireLogin, addPlotImage);
router.delete('/plots/:id/images', requireLogin, deletePlotImage);
router.put('/plots/:id/info', requireLogin, updatePlotInfo);
router.put('/plots/:id/carousel', requireLogin, updatePlotCarousel);
router.delete('/plots/:id', requireLogin, deletePlot);

// ======================
// 设置 (Settings) 路由 - 需要登录
// ======================
router.get('/settings', requireLogin, getAllSettings);
router.get('/settings/cta-background', requireLogin, getCTABackground);
router.post('/settings/cta-background', requireLogin, setCTABackground);
router.get('/settings/footer', requireLogin, getFooterSettings);
router.post('/settings/footer', requireLogin, saveFooterSettings);

// ======================
// 公开 API (无需登录)
// ======================
router.get('/public/landing-page', getPublicLandingPage);

export default router;

