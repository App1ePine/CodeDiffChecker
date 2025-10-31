import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { JwtPayload, SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'
import type { ResultSetHeader } from 'mysql2'
import { z } from 'zod'
import { pool, queryOne } from '../db'
import { COOKIE_NAME, env } from '../env'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'
import { epochSecondsToIsoString } from '../utils/datetime'
import { durationToSeconds } from '../utils/duration'
import { hashPassword, verifyPassword } from '../utils/password'

type AppEnv = {
  Variables: AppVariables
}

type DbUser = {
  id: number
  username: string
  email: string
  nickname: string
  password_hash: string
  created_at: number | string
  updated_at: number | string
}

const router = new Hono<AppEnv>()

const usernameSchema = z
  .string()
  .min(3)
  .max(12)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')

const registerSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email(),
    password: z.string().min(6).max(24),
    confirmPassword: z.string().min(6).max(24),
    nickname: z.string().min(2).max(24),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ['confirmPassword'],
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
      })
    }
  })

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6).max(24),
})

function resolveTokenLifetimeSeconds(): number {
  try {
    return durationToSeconds(env.TOKEN_EXPIRES_IN)
  } catch (error) {
    console.warn('Falling back to 7 days for TOKEN_EXPIRES_IN:', error)
    return 604800
  }
}

const tokenLifetimeSeconds = resolveTokenLifetimeSeconds()

function createToken(user: { id: number; username: string; email: string }) {
  const payload: JwtPayload = {
    sub: String(user.id),
    email: user.email,
    username: user.username,
  }

  const options: SignOptions = {
    expiresIn: tokenLifetimeSeconds,
  }

  return jwt.sign(payload, env.JWT_SECRET, options)
}

router.post('/register', async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { username, email, password, nickname } = parsed.data

  const existingUsername = await queryOne<Pick<DbUser, 'id'>>('SELECT id FROM users WHERE username = ?', [username])
  if (existingUsername) {
    return c.json({ error: 'Username already in use' }, 409)
  }

  const existingEmail = await queryOne<Pick<DbUser, 'id'>>('SELECT id FROM users WHERE email = ?', [email])
  if (existingEmail) {
    return c.json({ error: 'Email already in use' }, 409)
  }

  const passwordHash = await hashPassword(password)

  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())',
    [username, email, passwordHash, nickname]
  )

  const user = {
    id: Number(result.insertId),
    username,
    email,
    nickname,
  }

  const token = createToken(user)

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: tokenLifetimeSeconds,
  })

  return c.json({ user })
})

router.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { username, password } = parsed.data

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE username = ?', [username])
  if (!user) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const passwordValid = await verifyPassword(password, user.password_hash)
  if (!passwordValid) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
  }

  const token = createToken(safeUser)

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: tokenLifetimeSeconds,
  })

  return c.json({ user: safeUser })
})

router.post('/logout', (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ success: true })
})

router.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId')
  const user = await queryOne<Omit<DbUser, 'password_hash'>>(
    'SELECT id, username, email, nickname, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  )

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      createdAt: epochSecondsToIsoString(user.created_at),
      updatedAt: epochSecondsToIsoString(user.updated_at),
    },
  })
})

export default router
