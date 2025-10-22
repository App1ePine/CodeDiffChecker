import type { MiddlewareHandler } from 'hono';
import { verifyToken } from '../utils/jwt';
import type { AppBindings } from '../types/app';

export const authMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: '未提供授权信息' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    c.set('userId', payload.sub);
    await next();
  } catch (error) {
    console.error('JWT 验证失败', error);
    return c.json({ message: '身份验证失败' }, 401);
  }
};
