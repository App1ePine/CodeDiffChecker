import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { JwtPayload, SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { getDb } from '../db'
import { COOKIE_NAME, env } from '../env'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'
import { epochSecondsToIsoString } from '../utils/datetime'
import { durationToSeconds } from '../utils/duration'
import { hashPassword, verifyPassword } from '../utils/password'

type AppEnv = {
  Variables: AppVariables
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
    captchaAnswer: z
      .string()
      .min(4)
      .max(4)
      .regex(/^[a-zA-Z0-9]+$/, 'Captcha must contain only letters or numbers'),
    captchaToken: z.string().min(10),
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

function requireJwtSecret(): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return env.JWT_SECRET
}

function hashCaptchaAnswer(answer: string): string {
  const normalized = answer.trim().toUpperCase()
  const secret = requireJwtSecret()
  return createHmac('sha256', secret).update(normalized).digest('hex')
}

const captchaExpiresInSeconds = 300
const captchaLength = 4
const captchaCharset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const captchaWidth = 120
const captchaHeight = 32

function renderCaptchaSvg(code: string): string {
  const letterSpacing = captchaWidth / (code.length + 1)
  const noiseLines: string[] = []
  const noiseCount = 8

  for (let index = 0; index < noiseCount; index += 1) {
    const x1 = randomInt(0, captchaWidth)
    const y1 = randomInt(0, captchaHeight)
    const x2 = randomInt(0, captchaWidth)
    const y2 = randomInt(0, captchaHeight)
    const color = `#${randomInt(0x111111, 0xffffff).toString(16).padStart(6, '0')}`
    noiseLines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`)
  }

  const letters = code
    .split('')
    .map((char, index) => {
      const x = Math.floor(letterSpacing * (index + 1))
      const y = randomInt(Math.floor(captchaHeight * 0.6), Math.floor(captchaHeight * 0.85))
      const rotation = randomInt(-18, 18)
      const color = `#${randomInt(0x111111, 0x999999).toString(16).padStart(6, '0')}`
      return `<text x="${x}" y="${y}" fill="${color}" font-size="22" font-family="monospace" transform="rotate(${rotation} ${x} ${y})">${char}</text>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${captchaWidth}" height="${captchaHeight}" viewBox="0 0 ${captchaWidth} ${captchaHeight}">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    ${noiseLines.join('')}
    ${letters}
  </svg>`

  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

function createCaptchaChallenge() {
  let code = ''
  for (let index = 0; index < captchaLength; index += 1) {
    const charIndex = randomInt(0, captchaCharset.length)
    code += captchaCharset.charAt(charIndex)
  }

  return {
    image: renderCaptchaSvg(code),
    answer: code,
  }
}

type CaptchaPayload = {
  hash: string
  type: 'captcha'
}

function signCaptcha(answer: string): string {
  const secret = requireJwtSecret()
  const hash = hashCaptchaAnswer(answer)
  return jwt.sign({ hash, type: 'captcha' }, secret, { expiresIn: captchaExpiresInSeconds })
}

function verifyCaptcha(token: string, answer: string): boolean {
  try {
    const secret = requireJwtSecret()
    const payload = jwt.verify(token, secret) as CaptchaPayload
    if (!payload || payload.type !== 'captcha' || typeof payload.hash !== 'string') {
      return false
    }

    const expectedHash = Buffer.from(payload.hash)
    const providedHash = Buffer.from(hashCaptchaAnswer(answer))

    if (expectedHash.length !== providedHash.length) {
      return false
    }

    return timingSafeEqual(expectedHash, providedHash)
  } catch (error) {
    console.warn('Captcha verification failed:', error)
    return false
  }
}

function resolveTokenLifetimeSeconds(): number {
  try {
    return durationToSeconds(env.TOKEN_EXPIRES_IN)
  } catch (error) {
    console.warn('Falling back to 7 days for TOKEN_EXPIRES_IN:', error)
    return 604800
  }
}

const tokenLifetimeSeconds = resolveTokenLifetimeSeconds()

router.get('/captcha', (c) => {
  const captcha = createCaptchaChallenge()
  const token = signCaptcha(captcha.answer)

  return c.json({
    image: captcha.image,
    captchaToken: token,
    expiresIn: captchaExpiresInSeconds,
  })
})

function createToken(user: { id: number; username: string; email: string }) {
  const payload: JwtPayload = {
    sub: String(user.id),
    email: user.email,
    username: user.username,
  }

  const options: SignOptions = {
    expiresIn: tokenLifetimeSeconds,
  }

  return jwt.sign(payload, requireJwtSecret(), options)
}

router.post('/register', async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { username, email, password, nickname, captchaAnswer, captchaToken } = parsed.data

  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return c.json({ error: 'Invalid or expired captcha' }, 400)
  }
  const db = getDb()

  const existingUsername = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (existingUsername) {
    return c.json({ error: 'Username already in use' }, 409)
  }

  const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existingEmail) {
    return c.json({ error: 'Email already in use' }, 409)
  }

  const passwordHash = await hashPassword(password)

  const user = await db.user.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
      nickname,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    },
  })

  const token = createToken(user)

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: tokenLifetimeSeconds,
  })

  return c.json({ user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname } })
})

router.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { username, password } = parsed.data
  const db = getDb()

  const user = await db.user.findUnique({ where: { username } })
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
  const db = getDb()

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, nickname: true, created_at: true, updated_at: true },
  })

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
