import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcrypt';
import { registerSchema, loginSchema } from '../schemas/auth';
import { createUser, findUserByEmail } from '../db/userRepository';
import { signToken } from '../utils/jwt';
import type { AppBindings } from '../types/app';

const SALT_ROUNDS = 12;

export const authRoutes = new Hono<AppBindings>();

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return c.json({ message: '邮箱已被注册' }, 400);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await createUser(email, passwordHash);
  const token = signToken(userId);

  return c.json({
    token,
    user: {
      id: userId,
      email
    }
  });
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const user = await findUserByEmail(email);

  if (!user) {
    return c.json({ message: '邮箱或密码错误' }, 401);
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return c.json({ message: '邮箱或密码错误' }, 401);
  }

  const token = signToken(user.id);

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email
    }
  });
});

export default authRoutes;
