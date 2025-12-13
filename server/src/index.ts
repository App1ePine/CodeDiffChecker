import { serve } from '@hono/node-server'
import app from './app'
import { env } from './env'

const port = env.PORT

serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
})

console.log(`🚀 API server listening on http://localhost:${port}`)
