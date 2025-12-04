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

export let isInstalled = existsSync(resolve(process.cwd(), 'server/.env'))

const loadEnvs = () => {
  loadEnvFile('server/.env', { override: true })
  loadEnvFile(`server/.env.${mode}`, { override: true })
  loadEnvFile('server/.env.local', { override: true })
}

loadEnvs()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DB_TYPE: z.enum(['mysql', 'postgresql', 'mssql']).optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_ADMIN_HOST: z.string().optional(),
  DB_ADMIN_PORT: z.coerce.number().optional(),
  DB_ADMIN_USER: z.string().optional(),
  DB_ADMIN_PASSWORD: z.string().optional(),
  DB_BACKUP_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  TOKEN_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3001'),
  SHARE_BASE_URL: z.string().default('http://localhost:3001'),
})

type EnvShape = z.infer<typeof envSchema>

const applyDerivedDefaults = (config: EnvShape): EnvShape => {
  let defaultPort = 3306
  if (config.DB_TYPE === 'postgresql') {
    defaultPort = 5432
  } else if (config.DB_TYPE === 'mssql') {
    defaultPort = 1433
  }
  return {
    ...config,
    DB_PORT: config.DB_PORT ?? defaultPort,
  }
}

export let env = applyDerivedDefaults(envSchema.parse(process.env))

export const reloadEnv = () => {
  isInstalled = existsSync(resolve(process.cwd(), 'server/.env'))
  loadEnvs()
  env = applyDerivedDefaults(envSchema.parse(process.env))
}

export const COOKIE_NAME = 'cdc_token'
