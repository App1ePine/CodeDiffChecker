import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { appConfig } from './config/env';
import { rateLimit } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import pasteRoutes from './routes/pastes';
import type { AppBindings } from './types/app';

const app = new Hono<AppBindings>();

app.use('*', logger());
app.use('*', rateLimit());
app.use(
  '*',
  cors({
    origin: appConfig.cors.origin,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', authRoutes);
app.route('/pastes', pasteRoutes);

serve({
  fetch: app.fetch,
  port: appConfig.port
});

console.log(`🚀 服务器已启动，端口：${appConfig.port}`);
