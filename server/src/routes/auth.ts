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
import { durationToSeconds } from '../utils/duration'
import { hashPassword, verifyPassword } from '../utils/password'

type AppEnv = {
  Variables: AppVariables
}

type DbUser = {
  id: number
  email: string
  display_name: string
  password_hash: string
  created_at: Date
  updated_at: Date
}

const router = new Hono<AppEnv>()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  displayName: z.string().min(2).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function resolveTokenLifetimeSeconds(): number {
  try {
    return durationToSeconds(env.TOKEN_EXPIRES_IN)
  } catch (error) {
    console.warn('Falling back to 7 days for TOKEN_EXPIRES_IN:', error)
    return 60 * 60 * 24 * 7
  }
}

const tokenLifetimeSeconds = resolveTokenLifetimeSeconds()

function createToken(user: { id: number; email: string }) {
  const payload: JwtPayload = {
    sub: String(user.id),
    email: user.email,
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

  const { displayName, email, password } = parsed.data

  const existingUser = await queryOne<Pick<DbUser, 'id'>>('SELECT id FROM users WHERE email = ?', [email])
  if (existingUser) {
    return c.json({ error: 'Email already in use' }, 409)
  }

  const passwordHash = await hashPassword(password)

  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
    [email, passwordHash, displayName]
  )

  const user = {
    id: Number(result.insertId),
    email,
    displayName,
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

  const { email, password } = parsed.data

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE email = ?', [email])
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const passwordValid = await verifyPassword(password, user.password_hash)
  if (!passwordValid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
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
    'SELECT id, email, display_name, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  )

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
  })
})

export default router
