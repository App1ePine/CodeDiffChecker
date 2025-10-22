import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { Counter, collectDefaultMetrics, Histogram, register } from 'prom-client'
import PastesRepository from './pastes-repository.js'

const app = express()
const port = Number.parseInt(process.env.PORT ?? '4000', 10)
const defaultUserId = process.env.DEFAULT_USER_ID ?? 'demo-user'
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? ''

const repository = new PastesRepository()

collectDefaultMetrics()

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: '请求耗时（秒）',
  labelNames: ['method', 'route', 'status_code'],
})

const shareViewCounter = new Counter({
  name: 'paste_share_views_total',
  help: 'Paste 分享链接访问总数',
})

const shareErrorCounter = new Counter({
  name: 'paste_share_unavailable_total',
  help: 'Paste 分享链接不可用统计',
  labelNames: ['reason'],
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('combined'))

app.use((req, res, next) => {
  req.userId = req.header('x-user-id') ?? defaultUserId
  const end = httpDuration.startTimer({ method: req.method })
  res.on('finish', () => {
    const route = req.route?.path ?? req.originalUrl ?? 'unknown'
    end({ route, status_code: res.statusCode })
  })
  next()
})

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.get('/pastes', async (req, res, next) => {
  try {
    const data = await repository.list(req.userId, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      visibility: req.query.visibility,
      status: req.query.status,
    })
    const baseUrl = publicBaseUrl || `${req.protocol}://${req.get('host')}`
    res.json({
      ...data,
      items: data.items.map((item) => ({
        ...item,
        shareUrl: `${baseUrl}/share/${item.shareId}`,
      })),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/pastes', async (req, res, next) => {
  try {
    const { title, content, visibility, expiresAt } = req.body ?? {}
    const paste = await repository.create(req.userId, {
      title,
      content,
      visibility,
      expiresAt,
    })
    const baseUrl = publicBaseUrl || `${req.protocol}://${req.get('host')}`
    res.status(201).json({
      ...paste,
      shareUrl: `${baseUrl}/share/${paste.shareId}`,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/pastes/:id', async (req, res, next) => {
  try {
    const paste = await repository.findById(req.userId, req.params.id)
    if (!paste) {
      res.status(404).json({ message: 'Paste 不存在' })
      return
    }
    const baseUrl = publicBaseUrl || `${req.protocol}://${req.get('host')}`
    res.json({
      ...paste,
      shareUrl: `${baseUrl}/share/${paste.shareId}`,
    })
  } catch (error) {
    next(error)
  }
})

app.patch('/pastes/:id', async (req, res, next) => {
  try {
    const { title, visibility, expiresAt, content } = req.body ?? {}
    const updates = {}
    if (title !== undefined) updates.title = title
    if (visibility !== undefined) updates.visibility = visibility
    if (expiresAt !== undefined) updates.expiresAt = expiresAt
    if (content !== undefined) updates.content = content
    const paste = await repository.update(req.userId, req.params.id, updates)
    if (!paste) {
      res.status(404).json({ message: 'Paste 不存在' })
      return
    }
    const baseUrl = publicBaseUrl || `${req.protocol}://${req.get('host')}`
    res.json({
      ...paste,
      shareUrl: `${baseUrl}/share/${paste.shareId}`,
    })
  } catch (error) {
    next(error)
  }
})

app.delete('/pastes/:id', async (req, res, next) => {
  try {
    const deleted = await repository.delete(req.userId, req.params.id)
    if (!deleted) {
      res.status(404).json({ message: 'Paste 不存在' })
      return
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/share/:shareId', async (req, res, next) => {
  try {
    const paste = await repository.findByShareId(req.params.shareId)
    if (!paste) {
      shareErrorCounter.inc({ reason: 'not_found' })
      res.status(404).json({ message: '分享链接不存在' })
      return
    }

    if (paste.visibility === 'private') {
      shareErrorCounter.inc({ reason: 'private' })
      res.status(403).json({ message: '分享链接不可访问' })
      return
    }

    if (repository.isExpired(paste)) {
      shareErrorCounter.inc({ reason: 'expired' })
      res.status(410).json({ message: '分享链接已过期' })
      return
    }

    shareViewCounter.inc()

    res.json({
      id: paste.id,
      title: paste.title,
      content: paste.content,
      visibility: paste.visibility,
      expiresAt: paste.expiresAt,
    })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error('请求处理失败', error)
  const status = error.message === 'Invalid expiresAt value' ? 400 : (error.status ?? 500)
  res.status(status).json({ message: error.message ?? '服务器异常' })
})

app.listen(port, () => {
  console.log(`Paste 服务已启动，端口 ${port}`)
})
