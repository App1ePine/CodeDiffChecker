import { Hono } from 'hono'
import { queryOne } from '../db'
import { epochSecondsToIsoString, normalizeEpochSeconds } from '../utils/datetime'

type PublicShare = {
  slug: string
  title: string
  left_content: string
  right_content: string
  hidden: number
  expires_at: number | string | null
  created_at: number | string
  updated_at: number | string
  deleted_at: number | string | null
  owner_name: string
}

const router = new Hono()

router.get('/shares/:slug', async (c) => {
  const slug = c.req.param('slug')
  const share = await queryOne<PublicShare>(
    `
      SELECT 
        s.*, 
        u.nickname as owner_name
      FROM shares s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.slug = ?
        AND s.deleted_at IS NULL
    `,
    [slug]
  )

  if (!share) {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ error: 'Share not found' }, 404)
  }

  if (share.hidden === 1) {
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
      ownerName: share.owner_name,
      expiresAt: epochSecondsToIsoString(share.expires_at),
      createdAt: epochSecondsToIsoString(share.created_at),
      updatedAt: epochSecondsToIsoString(share.updated_at),
    },
  })
})

export default router
