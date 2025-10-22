import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DEFAULT_FILE_PATH = join(__dirname, 'data', 'pastes.json')
const VISIBILITY_VALUES = new Set(['public', 'unlisted', 'private'])

export class PastesRepository {
  constructor(options = {}) {
    this.filePath = options.filePath ?? DEFAULT_FILE_PATH
  }

  async list(userId, options = {}) {
    const now = new Date()
    const page = Math.max(1, Number.parseInt(options.page ?? '1', 10) || 1)
    const pageSize = Math.max(1, Number.parseInt(options.pageSize ?? '10', 10) || 10)
    const visibility = options.visibility
    const status = options.status
    const all = await this.#readAll()

    let items = all.filter((item) => item.ownerId === userId && !item.deletedAt)

    if (visibility && VISIBILITY_VALUES.has(visibility)) {
      items = items.filter((item) => item.visibility === visibility)
    }

    if (status === 'expired') {
      items = items.filter((item) => this.#isExpired(item, now))
    } else if (status === 'active') {
      items = items.filter((item) => !this.#isExpired(item, now))
    }

    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    const total = items.length
    const start = (page - 1) * pageSize
    const paginated = items.slice(start, start + pageSize).map((item) => this.#toSummary(item, now))

    return {
      items: paginated,
      total,
      page,
      pageSize,
      hasNext: start + pageSize < total,
    }
  }

  async create(userId, payload) {
    const now = new Date()
    const all = await this.#readAll()

    const newPaste = {
      id: randomUUID(),
      shareId: randomUUID().replace(/-/g, ''),
      ownerId: userId,
      title: this.#normalizeTitle(payload.title),
      content: this.#normalizeContent(payload.content),
      visibility: this.#normalizeVisibility(payload.visibility),
      expiresAt: this.#normalizeExpiresAt(payload.expiresAt),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    }

    all.push(newPaste)
    await this.#writeAll(all)

    return this.#toFull(newPaste, now)
  }

  async update(userId, pasteId, payload) {
    const all = await this.#readAll()
    const index = all.findIndex((item) => item.id === pasteId && item.ownerId === userId && !item.deletedAt)

    if (index === -1) return null

    const now = new Date()
    const existing = all[index]

    if ('title' in payload) {
      existing.title = this.#normalizeTitle(payload.title)
    }
    if ('visibility' in payload) {
      existing.visibility = this.#normalizeVisibility(payload.visibility)
    }
    if ('expiresAt' in payload) {
      existing.expiresAt = this.#normalizeExpiresAt(payload.expiresAt)
    }
    if ('content' in payload) {
      existing.content = this.#normalizeContent(payload.content)
    }

    existing.updatedAt = now.toISOString()

    all[index] = existing
    await this.#writeAll(all)

    return this.#toFull(existing, now)
  }

  async delete(userId, pasteId) {
    const all = await this.#readAll()
    const index = all.findIndex((item) => item.id === pasteId && item.ownerId === userId && !item.deletedAt)

    if (index === -1) return false

    all[index].deletedAt = new Date().toISOString()
    await this.#writeAll(all)
    return true
  }

  async findById(userId, pasteId) {
    const all = await this.#readAll()
    const paste = all.find((item) => item.id === pasteId && item.ownerId === userId && !item.deletedAt)
    if (!paste) return null
    return this.#toFull(paste)
  }

  async findByShareId(shareId) {
    const all = await this.#readAll()
    const paste = all.find((item) => item.shareId === shareId && !item.deletedAt)
    if (!paste) return null
    return this.#toFull(paste)
  }

  isExpired(paste, now = new Date()) {
    return this.#isExpired(paste, now)
  }

  #normalizeTitle(title) {
    if (typeof title !== 'string') return '未命名 Paste'
    const trimmed = title.trim()
    return trimmed.length > 0 ? trimmed : '未命名 Paste'
  }

  #normalizeContent(content) {
    if (typeof content !== 'string') return ''
    return content
  }

  #normalizeVisibility(visibility) {
    if (typeof visibility !== 'string') return 'public'
    const normalized = visibility.toLowerCase()
    return VISIBILITY_VALUES.has(normalized) ? normalized : 'public'
  }

  #normalizeExpiresAt(expiresAt) {
    if (expiresAt === undefined || expiresAt === null || expiresAt === '') {
      return null
    }
    const date = new Date(expiresAt)
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid expiresAt value')
    }
    return date.toISOString()
  }

  #isExpired(paste, now = new Date()) {
    if (!paste.expiresAt) return false
    return new Date(paste.expiresAt).getTime() <= now.getTime()
  }

  #toSummary(paste, now = new Date()) {
    return {
      id: paste.id,
      title: paste.title,
      visibility: paste.visibility,
      expiresAt: paste.expiresAt,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt,
      shareId: paste.shareId,
      expired: this.#isExpired(paste, now),
    }
  }

  #toFull(paste, now = new Date()) {
    return {
      ...this.#toSummary(paste, now),
      content: paste.content,
      ownerId: paste.ownerId,
    }
  }

  async #readAll() {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw)
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        await this.#writeAll([])
        return []
      }
      throw error
    }
  }

  async #writeAll(data) {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }
}

export default PastesRepository
