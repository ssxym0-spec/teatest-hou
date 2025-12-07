import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { PUBLIC_DIR, VIEWS_DIR, UPLOADS_DIR } from './config/paths';
import authRoutes from './routes/authRoutes';
import categoryRoutes from './routes/categoryRoutes';
import harvestRoutes from './routes/harvestRoutes';
import traceabilityRoutes from './routes/traceabilityRoutes';
import landingRoutes from './routes/landingRoutes';
import templateRoutes from './routes/templateRoutes';
import managementRoutes from './routes/managementRoutes';
import uploadRoutes from './routes/uploadRoutes';
import growthRoutes from './routes/growthRoutes';
import summaryRoutes from './routes/summaryRoutes';
import publicRoutes from './routes/publicRoutes';
import { requireLogin } from './middleware/auth';
import { changePassword } from './controllers/authController';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

// CORS 配置：优先从环境变量读取，否则使用默认值
const frontendUrl = process.env.FRONTEND_URL || 'https://tea.goodcat.ggff.net';
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  frontendUrl,
];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(express.static(PUBLIC_DIR));
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      // 仅对静态文件设置长期缓存头，避免覆盖其他中间件的配置
      if (!res.getHeader('Cache-Control')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);
app.use(express.static(VIEWS_DIR));

app.get('/', (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'login.html'));
});

// 登录页面路由
app.get('/login', (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'login.html'));
});

// Dashboard 路由处理
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'dashboard.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'dashboard.html'));
});

// 修改密码页面路由
app.get('/change-password', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'change-password.html'));
});

// 修改密码提交路由
app.post('/change-password', requireLogin, changePassword);

// 模板管理中心（索引页）：固定路由，避免被通配 /admin/:page 误导向详情页
app.get('/admin/template-management', requireLogin, (_req, res) => {
  // 模板管理中心入口页（包含六个卡片）
  res.sendFile(path.join(VIEWS_DIR, 'template-hub.html'));
});

// 制作步骤模板管理页
app.get('/admin/step-templates', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'template-management.html'));
});

// 批次详情标题模板管理页
app.get('/admin/title-templates', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'title-template-management.html'));
});

// 鉴赏模板管理页
app.get('/admin/appreciation-templates', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'appreciation-template-management.html'));
});

// 人员管理模板页
app.get('/admin/personnel-management', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'personnel-management.html'));
});

// 等级管理模板页
app.get('/admin/grade-management', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'grade-management.html'));
});

// 天气模板管理页
app.get('/admin/weather-templates', requireLogin, (_req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'weather-template-management.html'));
});

// 兜底处理 /admin/:page 路由（放在所有明确的 /admin/* 路由之后）
app.get('/admin/:page', (req, res) => {
  const page = req.params.page;
  const filePath = path.join(VIEWS_DIR, `${page}.html`);

  // 检查文件是否存在
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('页面未找到');
  }
});

// 公共 API 路由（无需认证）必须在所有其他 /api 路由之前注册
app.use('/api/public', publicRoutes);

// 私有 API 路由（需要认证）
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/harvest-records', harvestRoutes);
app.use('/api/batches', traceabilityRoutes);
app.use('/api', landingRoutes);
app.use('/api', templateRoutes);
app.use('/api', managementRoutes);
app.use('/api', uploadRoutes);
app.use('/api/growth-logs', growthRoutes);
app.use('/api', summaryRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

export default app;


