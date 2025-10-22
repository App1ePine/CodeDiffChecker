import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth';
import type { AppBindings } from '../types/app';
import { createPasteSchema } from '../schemas/paste';
import { createPaste, findPasteBySlug, listPastesByUser } from '../db/pasteRepository';
import { generateUniqueSlug } from '../utils/slug';

export const pasteRoutes = new Hono<AppBindings>();

pasteRoutes.post('/', authMiddleware, zValidator('json', createPasteSchema), async (c) => {
  const userId = c.get('userId');
  const { title = null, leftContent, rightContent, visibility, expiresAt = null } = c.req.valid('json');

  const slug = await generateUniqueSlug();
  const expiresDate = expiresAt ? new Date(expiresAt) : null;

  await createPaste(userId, {
    title,
    leftContent,
    rightContent,
    visibility,
    slug,
    expiresAt: expiresDate
  });

  return c.json({ slug });
});

pasteRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const paste = await findPasteBySlug(slug);

  if (!paste) {
    return c.json({ message: '未找到对应的 Paste' }, 404);
  }

  if (paste.visibility === 'private') {
    return c.json({ message: '该 Paste 不公开' }, 404);
  }

  if (paste.expires_at && paste.expires_at < new Date()) {
    return c.json({ message: '该 Paste 已过期' }, 410);
  }

  return c.json({
    slug: paste.slug,
    title: paste.title,
    leftContent: paste.left_content,
    rightContent: paste.right_content,
    visibility: paste.visibility,
    expiresAt: paste.expires_at,
    authorId: paste.user_id,
    createdAt: paste.created_at
  });
});

pasteRoutes.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const pastes = await listPastesByUser(userId);

  return c.json(
    pastes.map((paste) => ({
      slug: paste.slug,
      title: paste.title,
      visibility: paste.visibility,
      expiresAt: paste.expires_at,
      createdAt: paste.created_at
    }))
  );
});

export default pasteRoutes;
