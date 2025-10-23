import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'

const candidateEnvPaths = [resolve(process.cwd(), 'server/.env'), resolve(process.cwd(), '.env')]

for (const envPath of candidateEnvPaths) {
	if (existsSync(envPath)) {
		config({ path: envPath })
	}
}

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().default(4000),
	DB_HOST: z.string(),
	DB_PORT: z.coerce.number().default(3306),
	DB_NAME: z.string(),
	DB_USER: z.string(),
	DB_PASSWORD: z.string(),
	JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
	TOKEN_EXPIRES_IN: z.string().default('7d'),
	FRONTEND_ORIGIN: z.string().default('http://localhost:3001'),
	SHARE_BASE_URL: z.string().default('http://localhost:3001'),
})

export const env = envSchema.parse(process.env)

export const COOKIE_NAME = 'cdc_token'
