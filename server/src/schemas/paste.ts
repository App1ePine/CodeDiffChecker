import { z } from 'zod';

export const pasteVisibilityEnum = z.enum(['public', 'unlisted', 'private']);

export const createPasteSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  leftContent: z.string().min(1, '左侧代码不能为空'),
  rightContent: z.string().min(1, '右侧代码不能为空'),
  visibility: pasteVisibilityEnum.default('public'),
  expiresAt: z.coerce.date().optional().nullable()
});

export type CreatePasteInput = z.infer<typeof createPasteSchema>;
