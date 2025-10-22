import { execute, query } from './pool';

export type PasteVisibility = 'public' | 'unlisted' | 'private';

export type PasteRecord = {
  id: number;
  user_id: number;
  title: string | null;
  left_content: string;
  right_content: string;
  visibility: PasteVisibility;
  slug: string;
  expires_at: Date | null;
  created_at: Date;
};

export async function createPaste(
  userId: number,
  data: {
    title: string | null;
    leftContent: string;
    rightContent: string;
    visibility: PasteVisibility;
    slug: string;
    expiresAt: Date | null;
  }
): Promise<number> {
  const result = await execute(
    `INSERT INTO pastes (user_id, title, left_content, right_content, visibility, slug, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId,
      data.title,
      data.leftContent,
      data.rightContent,
      data.visibility,
      data.slug,
      data.expiresAt
    ]
  );
  const insertId = typeof result.insertId === 'bigint' ? Number(result.insertId) : result.insertId;
  return insertId as number;
}

export async function findPasteBySlug(slug: string): Promise<PasteRecord | null> {
  const rows = await query<PasteRecord>(
    `SELECT id, user_id, title, left_content, right_content, visibility, slug, expires_at, created_at
     FROM pastes WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const rows = await query<{ count: number | bigint }>('SELECT COUNT(*) as count FROM pastes WHERE slug = ?', [slug]);
  const countRow = rows[0];
  const count = countRow?.count ?? 0;
  return Number(count) > 0;
}

export async function listPastesByUser(userId: number): Promise<PasteRecord[]> {
  return query<PasteRecord>(
    `SELECT id, user_id, title, left_content, right_content, visibility, slug, expires_at, created_at
     FROM pastes WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
}
