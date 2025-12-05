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


