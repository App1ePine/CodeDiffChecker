import type { MiddlewareHandler } from 'hono';
import { appConfig } from '../config/env';

export const rateLimit = (): MiddlewareHandler => {
  const hits = new Map<string, { count: number; start: number }>();
  const { windowMs, max } = appConfig.rateLimit;

  return async (c, next) => {
    const now = Date.now();
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      c.req.raw.headers.get('x-forwarded-for') ??
      c.req.raw.headers.get('x-real-ip') ??
      c.req.raw.headers.get('cf-connecting-ip') ??
      c.req.raw.headers.get('remote-addr') ??
      'unknown';

    const existing = hits.get(ip);
    if (existing && now - existing.start < windowMs) {
      if (existing.count >= max) {
        const retryAfter = Math.ceil((windowMs - (now - existing.start)) / 1000);
        c.header('Retry-After', retryAfter.toString());
        return c.json({ message: '请求过于频繁，请稍后再试' }, 429);
      }
      existing.count += 1;
    } else {
      hits.set(ip, { count: 1, start: now });
    }

    await next();

    // 清理过期数据
    for (const [key, value] of hits) {
      if (now - value.start >= windowMs) {
        hits.delete(key);
      }
    }
  };
};
