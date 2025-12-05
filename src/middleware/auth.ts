import type { Request, Response, NextFunction } from 'express';

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  // 明确排除公共 API 路由
  if (req.originalUrl.startsWith('/api/public/')) {
    return next();
  }

  if (req.session && req.session.user) {
    // 用户已登录，继续处理请求
    next();
  } else {
    // 用户未登录
    // 注意：很多受保护路由是通过 app.use('/api', router) 注册的，
    // 此时 req.path 只会是 '/xxx'，不会包含 '/api' 前缀，
    // 因此需要使用 originalUrl 来判断是否为 API 请求。
    const isApiRequest =
      req.originalUrl.startsWith('/api/') ||
      req.headers.accept?.includes('application/json') ||
      req.xhr === true;

    // 对 API 请求返回 JSON 错误
    if (isApiRequest) {
      return res.status(401).json({
        success: false,
        message: '请先登录',
      });
    }
    // 对页面请求重定向到登录页
    return res.redirect('/?error=unauthorized');
  }
}

