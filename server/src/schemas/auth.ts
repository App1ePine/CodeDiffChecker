import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, '密码长度至少为 8 个字符')
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, '密码不能为空')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
