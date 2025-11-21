import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import { COOKIE_NAME, env } from '../env'
import type { AppVariables } from '../types'

type AppEnv = {
  Variables: AppVariables
}

type TokenPayload = {
  sub: string
  email: string
  username: string
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured')
    }
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload
    c.set('userId', Number.parseInt(payload.sub, 10))
    c.set('userEmail', payload.email)
    c.set('userName', payload.username)
    await next()
  } catch (error) {
    console.error('Token verification failed', error)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
