import { Hono } from 'hono'
import type { ResultSetHeader } from 'mysql2'
import { z } from 'zod'
import { pool, query, queryOne } from '../db'
import { env } from '../env'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'
import { mysqlDateToIsoString, toMySqlDateTime } from '../utils/datetime'
import { createShareSlug } from '../utils/slug'

type AppEnv = {
  Variables: AppVariables
}

type DbShare = {
  id: number
  user_id: number
  slug: string
  title: string
  left_content: string
  right_content: string
  hidden: number
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

const router = new Hono<AppEnv>()

const createShareSchema = z.object({
  title: z.string().min(1).max(255),
  leftContent: z.string().min(1),
  rightContent: z.string().min(1),
  hidden: z.boolean().optional().default(false),
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
  const shares = await query<DbShare>('SELECT * FROM shares WHERE user_id = ? ORDER BY created_at DESC', [userId])

  return c.json({
    shares: shares.map((share) => ({
      id: share.id,
      slug: share.slug,
      title: share.title,
      hidden: share.hidden === 1,
      expiresAt: mysqlDateToIsoString(share.expires_at),
      createdAt: mysqlDateToIsoString(share.created_at)!,
      updatedAt: mysqlDateToIsoString(share.updated_at)!,
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
  const expiresAtSql = expiresAt ? toMySqlDateTime(expiresAt) : null

  const slug = await reserveUniqueSlug()

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO shares (user_id, slug, title, left_content, right_content, hidden, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, slug, title, leftContent, rightContent, hidden ? 1 : 0, expiresAtSql]
  )

  return c.json({
    share: {
      id: Number(result.insertId),
      slug,
      title,
      hidden,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
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

  const share = await queryOne<DbShare>('SELECT * FROM shares WHERE id = ? AND user_id = ?', [shareId, userId])

  if (!share) {
    return c.json({ error: 'Share not found' }, 404)
  }

  const updates: string[] = []
  const params: unknown[] = []

  if (parsed.data.title !== undefined) {
    updates.push('title = ?')
    params.push(parsed.data.title)
  }

  if (parsed.data.hidden !== undefined) {
    updates.push('hidden = ?')
    params.push(parsed.data.hidden ? 1 : 0)
  }

  if (parsed.data.expiresAt !== undefined) {
    updates.push('expires_at = ?')
    params.push(parsed.data.expiresAt ? toMySqlDateTime(parsed.data.expiresAt) : null)
  }

  if (updates.length === 0) {
    return c.json({ error: 'Nothing to update' }, 400)
  }

  params.push(shareId, userId)

  await pool.execute(`UPDATE shares SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`, params)

  const updated = await queryOne<DbShare>('SELECT * FROM shares WHERE id = ? AND user_id = ?', [shareId, userId])

  if (!updated) {
    return c.json({ error: 'Share not found after update' }, 404)
  }

  return c.json({
    share: {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      hidden: updated.hidden === 1,
      expiresAt: mysqlDateToIsoString(updated.expires_at),
      createdAt: mysqlDateToIsoString(updated.created_at)!,
      updatedAt: mysqlDateToIsoString(updated.updated_at)!,
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

  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM shares WHERE id = ? AND user_id = ?', [
    shareId,
    userId,
  ])

  if (result.affectedRows === 0) {
    return c.json({ error: 'Share not found' }, 404)
  }

  return c.json({ success: true })
})

export default router

async function reserveUniqueSlug(): Promise<string> {
  let attempts = 0
  while (attempts < 5) {
    const slugCandidate = createShareSlug()
    const existing = await queryOne<Pick<DbShare, 'id'>>('SELECT id FROM shares WHERE slug = ?', [slugCandidate])
    if (!existing) {
      return slugCandidate
    }
    attempts += 1
  }
  throw new Error('Unable to generate unique share slug')
}
