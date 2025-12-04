import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db'
import { epochSecondsToIsoString, normalizeEpochSeconds } from '../utils/datetime'

const router = new Hono()

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(12),
})

router.get('/shares', async (c) => {
  const query = c.req.query()
  const parsed = listQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const { page, pageSize } = parsed.data
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  const where = {
    hidden: false,
    deleted_at: null,
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  }

  const [total, shares] = await Promise.all([
    db.share.count({ where }),
    db.share.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { nickname: true } },
      },
    }),
  ])

  return c.json({
    shares: shares.map((share) => ({
      slug: share.slug,
      title: share.title,
      ownerName: share.user.nickname,
      expiresAt: epochSecondsToIsoString(share.expires_at),
      createdAt: epochSecondsToIsoString(share.created_at),
      updatedAt: epochSecondsToIsoString(share.updated_at),
    })),
    pagination: {
      page,
      pageSize,
      total,
    },
  })
})

router.get('/shares/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = getDb()

  const share = await db.share.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          nickname: true,
        },
      },
    },
  })

  if (!share || share.deleted_at !== null) {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ error: 'Share not found' }, 404)
  }

  const expiresAtSeconds = normalizeEpochSeconds(share.expires_at)
  if (expiresAtSeconds !== null && expiresAtSeconds <= Math.floor(Date.now() / 1000)) {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ error: 'Share has expired' }, 410)
  }

  return c.json({
    share: {
      slug: share.slug,
      title: share.title,
      leftContent: share.left_content,
      rightContent: share.right_content,
      ownerName: share.user.nickname,
      expiresAt: epochSecondsToIsoString(share.expires_at),
      createdAt: epochSecondsToIsoString(share.created_at),
      updatedAt: epochSecondsToIsoString(share.updated_at),
    },
  })
})

export default router
