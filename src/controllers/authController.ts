import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

/**
 * 处理登录请求，支持 JSON API 响应：
 * - 校验必填字段
 * - 校验用户名是否存在以及密码是否匹配
 * - 写入 session 并返回成功响应
 * - 失败时返回 JSON 错误响应
 */
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的用户名和密码',
      });
    }

    const normalizedUsername = username.trim();
    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (!user) {
      console.log(`登录失败：用户 ${normalizedUsername} 不存在`);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      console.log(`登录失败：用户 ${normalizedUsername} 密码错误`);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
    };

    console.log(`✅ 用户 ${normalizedUsername} 登录成功`);
    return res.status(200).json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('登录处理过程中发生错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 处理注册请求，创建新的管理员账户。
 * 若前端传递 confirmPassword，将执行一致性校验。
 */
export async function register(req: Request, res: Response) {
  try {
    const { username, password, confirmPassword } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空',
      });
    }

    if (typeof confirmPassword === 'string' && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: '两次输入的密码不一致',
      });
    }

    const normalizedUsername = username.trim();
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const newUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash,
      },
    });

    console.log(`✅ 成功注册用户 ${normalizedUsername}`);
    return res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('注册处理过程中发生错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误，注册失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

/**
 * 处理修改密码请求
 * - 验证用户已登录
 * - 校验当前密码是否正确
 * - 校验新密码格式和确认密码一致性
 * - 更新密码并销毁会话，要求用户重新登录
 */
export async function changePassword(req: Request, res: Response) {
  try {
    // 检查用户是否已登录
    if (!req.session.user || !req.session.user.id) {
      return res.redirect('/login?error=login-required');
    }

    const { oldPassword, newPassword, confirmPassword } = req.body ?? {};

    // 验证必填字段
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.redirect('/change-password?error=missing-fields');
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return res.redirect('/change-password?error=password-too-short');
    }

    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      return res.redirect('/change-password?error=password-mismatch');
    }

    // 获取当前用户信息
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
    });

    if (!user) {
      return res.redirect('/change-password?error=user-not-found');
    }

    // 验证当前密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      return res.redirect('/change-password?error=invalid-old-password');
    }

    // 检查新旧密码是否相同
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.redirect('/change-password?error=same-password');
    }

    // 加密新密码
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // 销毁会话，要求用户重新登录
    req.session.destroy((err) => {
      if (err) {
        console.error('销毁会话时发生错误:', err);
        return res.redirect('/change-password?error=session-destroy-failed');
      }

      console.log(`✅ 用户 ${user.username} 密码修改成功`);
      // 重定向到登录页面，显示成功消息
      res.redirect('/login?message=password-changed-success');
    });
  } catch (error) {
    console.error('修改密码处理过程中发生错误:', error);
    return res.redirect('/change-password?error=server-error');
  }
}


