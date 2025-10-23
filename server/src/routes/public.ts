import { Hono } from 'hono'
import { queryOne } from '../db'
import { mysqlDateToIsoString } from '../utils/datetime'

type PublicShare = {
  slug: string
  title: string
  left_content: string
  right_content: string
  hidden: number
  expires_at: Date | null
  created_at: Date
  updated_at: Date
  owner_name: string
}

const router = new Hono()

router.get('/shares/:slug', async (c) => {
  const slug = c.req.param('slug')
  const share = await queryOne<PublicShare>(
    `SELECT s.*, u.display_name as owner_name
     FROM shares s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.slug = ?`,
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

  const expiresAtIso = mysqlDateToIsoString(share.expires_at)
  const expiresAtMs = expiresAtIso ? Date.parse(expiresAtIso) : null
  if (expiresAtMs !== null && expiresAtMs <= Date.now()) {
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
      expiresAt: expiresAtIso,
      createdAt: mysqlDateToIsoString(share.created_at)!,
      updatedAt: mysqlDateToIsoString(share.updated_at)!,
    },
  })
})

export default router
