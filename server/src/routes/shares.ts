import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db'
import { env } from '../env'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'
import { epochSecondsToIsoString, toEpochSeconds } from '../utils/datetime'
import { hashPassword } from '../utils/password'
import { createShareSlug } from '../utils/slug'

type AppEnv = {
  Variables: AppVariables
}

const router = new Hono<AppEnv>()

const createShareSchema = z.object({
  title: z.string().min(1).max(255),
  leftContent: z.string().min(1),
  rightContent: z.string().min(1),
  hidden: z.boolean().optional().default(false),
  password: z
    .union([z.string().min(6).max(64), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value)),
  expiresAt: z
    .string()
    .datetime()
    .nullish()
    .transform((value) => (value ? new Date(value) : null)),
})

const updateShareSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    hidden: z.boolean().optional(),
    password: z
      .union([z.string().min(6).max(64), z.literal(''), z.null()])
      .optional()
      .transform((value) => (value === '' ? null : value)),
    expiresAt: z
      .string()
      .datetime()
      .nullish()
      .transform((value) => (value ? new Date(value) : null))
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

router.use('*', requireAuth)

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = getDb()
  const shares = await db.share.findMany({
    where: { user_id: userId, deleted_at: null },
    orderBy: { created_at: 'desc' },
  })

  return c.json({
    shares: shares.map((share) => ({
      id: share.id,
      slug: share.slug,
      title: share.title,
      hidden: share.hidden,
      hasPassword: Boolean(share.password_hash),
      expiresAt: epochSecondsToIsoString(share.expires_at),
      createdAt: epochSecondsToIsoString(share.created_at),
      updatedAt: epochSecondsToIsoString(share.updated_at),
      url: `${env.SHARE_BASE_URL}/shares/${share.slug}`,
    })),
  })
})

router.post('/', async (c) => {
  const userId = c.get('userId')

  const parsed = createShareSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { hidden, leftContent, rightContent, title, expiresAt } = parsed.data
  const password = parsed.data.password ?? null
  const expiresAtSeconds = expiresAt ? toEpochSeconds(expiresAt) : null
  const expiresAtIso = expiresAtSeconds === null ? null : epochSecondsToIsoString(expiresAtSeconds)

  const slug = await reserveUniqueSlug()
  const db = getDb()

  const passwordHash = password ? await hashPassword(password) : null

  const share = await db.share.create({
    data: {
      user_id: userId,
      slug,
      title,
      left_content: leftContent,
      right_content: rightContent,
      hidden,
      password_hash: passwordHash,
      expires_at: expiresAtSeconds,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    },
  })

  return c.json({
    share: {
      id: share.id,
      slug,
      title,
      hidden,
      hasPassword: Boolean(passwordHash),
      expiresAt: expiresAtIso,
      createdAt: epochSecondsToIsoString(share.created_at),
      updatedAt: epochSecondsToIsoString(share.updated_at),
      url: `${env.SHARE_BASE_URL}/shares/${slug}`,
    },
  })
})

router.patch('/:id', async (c) => {
  const shareId = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(shareId)) {
    return c.json({ error: 'Invalid share id' }, 400)
  }

  const parsed = updateShareSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const userId = c.get('userId')
  const db = getDb()

  const share = await db.share.findFirst({
    where: { id: shareId, user_id: userId, deleted_at: null },
  })

  if (!share) {
    return c.json({ error: 'Share not found' }, 404)
  }

  type ShareUpdateData = {
    updated_at: number
    title?: string
    hidden?: boolean
    password_hash?: string | null
    expires_at?: number | null
  }

  const data: ShareUpdateData = { updated_at: Math.floor(Date.now() / 1000) }

  if (parsed.data.title !== undefined) {
    data.title = parsed.data.title
  }

  if (parsed.data.hidden !== undefined) {
    data.hidden = parsed.data.hidden
  }

  if (parsed.data.password !== undefined) {
    const passwordValue = parsed.data.password
    data.password_hash = passwordValue ? await hashPassword(passwordValue) : null
  }

  if (parsed.data.expiresAt !== undefined) {
    data.expires_at = parsed.data.expiresAt ? toEpochSeconds(parsed.data.expiresAt) : null
  }

  const updated = await db.share.update({
    where: { id: shareId },
    data,
  })

  return c.json({
    share: {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      hidden: updated.hidden,
      hasPassword: Boolean(updated.password_hash),
      expiresAt: epochSecondsToIsoString(updated.expires_at),
      createdAt: epochSecondsToIsoString(updated.created_at),
      updatedAt: epochSecondsToIsoString(updated.updated_at),
      url: `${env.SHARE_BASE_URL}/shares/${updated.slug}`,
    },
  })
})

router.delete('/:id', async (c) => {
  const shareId = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(shareId)) {
    return c.json({ error: 'Invalid share id' }, 400)
  }

  const userId = c.get('userId')
  const db = getDb()

  const result = await db.share.updateMany({
    where: { id: shareId, user_id: userId, deleted_at: null },
    data: {
      deleted_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    },
  })

  if (result.count === 0) {
    return c.json({ error: 'Share not found' }, 404)
  }

  return c.json({ success: true })
})

export default router

async function reserveUniqueSlug(): Promise<string> {
  let attempts = 0
  const db = getDb()
  while (attempts < 5) {
    const slugCandidate = createShareSlug()
    const existing = await db.share.findUnique({ where: { slug: slugCandidate }, select: { id: true } })
    if (!existing) {
      return slugCandidate
    }
    attempts += 1
  }
  throw new Error('Unable to generate unique share slug')
}
