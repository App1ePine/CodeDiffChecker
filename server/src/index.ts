import { serve } from '@hono/node-server'
import app from './app'
import { pool } from './db'
import { env } from './env'

const port = env.PORT

pool
	.getConnection()
	.then((connection) => {
		connection.release()
		console.log('✅ Database connection established')
	})
	.catch((error) => {
		console.error('❌ Failed to connect to the database. Please check your configuration.', error)
		process.exitCode = 1
	})

serve({
	fetch: app.fetch,
	port,
})

console.log(`🚀 API server listening on http://localhost:${port}`)
