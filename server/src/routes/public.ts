import { Hono } from 'hono'
import { getDb } from '../db'
import { epochSecondsToIsoString, normalizeEpochSeconds } from '../utils/datetime'

const router = new Hono()

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

  if (share.hidden) {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ error: 'Share is unavailable' }, 404)
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
