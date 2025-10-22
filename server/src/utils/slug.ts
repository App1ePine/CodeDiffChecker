import { customAlphabet } from 'nanoid';
import { isSlugTaken } from '../db/pasteRepository';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const generate = customAlphabet(alphabet, 8);

export async function generateUniqueSlug(): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const slug = generate();
    if (!(await isSlugTaken(slug))) {
      return slug;
    }
    attempts += 1;
  }
  throw new Error('无法生成唯一的分享链接，请稍后再试');
}
