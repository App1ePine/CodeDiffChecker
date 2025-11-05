import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DotenvConfigOptions } from 'dotenv'
import dotenv from 'dotenv'
import { z } from 'zod'

const mode = process.env.NODE_ENV ?? 'development'

const loadEnvFile = (relativePath: string, options?: DotenvConfigOptions) => {
  const envPath = resolve(process.cwd(), relativePath)
  if (!existsSync(envPath)) return
  dotenv.config({ path: envPath, ...options })
}
loadEnvFile('server/.env')
loadEnvFile(`server/.env.${mode}`)
loadEnvFile('server/.env.local', { override: true })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_ADMIN_HOST: z.string().optional(),
  DB_ADMIN_PORT: z.coerce.number().optional(),
  DB_ADMIN_USER: z.string().optional(),
  DB_ADMIN_PASSWORD: z.string().optional(),
  DB_BACKUP_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  TOKEN_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3001'),
  SHARE_BASE_URL: z.string().default('http://localhost:3001'),
})

export const env = envSchema.parse(process.env)

export const COOKIE_NAME = 'cdc_token'
