import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env'
import authRoutes from './routes/auth'
import publicRoutes from './routes/public'
import shareRoutes from './routes/shares'
import type { AppVariables } from './types'

type AppEnv = {
  Variables: AppVariables
}

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (!origin) return env.FRONTEND_ORIGIN
      if (origin === env.FRONTEND_ORIGIN) return origin
      return ''
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 86400,
  })
)

app.use('/api/*', async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'no-store, max-age=0')
  }
})

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', authRoutes)
app.route('/api/shares', shareRoutes)
app.route('/api/public', publicRoutes)

export default app
