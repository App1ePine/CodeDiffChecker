import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { Counter, Histogram, renderMetrics } from './metrics.js'
import PastesRepository from './pastes-repository.js'

const port = Number.parseInt(process.env.PORT ?? '4000', 10)
const defaultUserId = process.env.DEFAULT_USER_ID ?? 'demo-user'
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? ''

const repository = new PastesRepository()

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

const routes = [
  { method: 'GET', path: '/health', handler: handleHealth },
  { method: 'GET', path: '/metrics', handler: handleMetrics },
  { method: 'GET', path: '/pastes', handler: handleListPastes },
  { method: 'POST', path: '/pastes', handler: handleCreatePaste, needsBody: true },
  { method: 'GET', path: '/pastes/:id', handler: handleGetPaste },
  { method: 'PATCH', path: '/pastes/:id', handler: handleUpdatePaste, needsBody: true },
  { method: 'DELETE', path: '/pastes/:id', handler: handleDeletePaste },
  { method: 'GET', path: '/share/:shareId', handler: handleGetShare },
]

const compiledRoutes = routes.map((route) => {
  const paramNames = []
  const pattern = route.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  const regex = new RegExp(`^${pattern}$`)
  return { ...route, regex, paramNames }
})

const server = createServer(async (req, res) => {
  const method = req.method?.toUpperCase() ?? 'GET'
  const requestUrl = req.url ?? '/'
  const originHost = req.headers.host ?? 'localhost'
  const url = new URL(requestUrl, `http://${originHost}`)

  applyCors(res)

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const logStart = process.hrtime.bigint()
  let routeLabel = 'unknown'
  const stopTimer = httpDuration.startTimer({ method })

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - logStart) / 1e6
    const logLine = `${new Date().toISOString()} ${method} ${url.pathname} ${res.statusCode} ${durationMs.toFixed(2)}ms`
    console.log(logLine)
    stopTimer({ route: routeLabel, status_code: String(res.statusCode) })
  })

  try {
    const match = findRoute(method, url.pathname)
    if (!match) {
      routeLabel = 'unknown'
      sendJson(res, 404, { message: '未找到接口' })
      return
    }

    routeLabel = match.path

    const context = {
      req,
      res,
      url,
      params: match.params,
      query: Object.fromEntries(url.searchParams.entries()),
      userId: getUserId(req),
      baseUrl: getBaseUrl(req),
      body: undefined,
    }

    if (match.needsBody) {
      context.body = await readJsonBody(req)
    }

    await match.handler(context)
  } catch (error) {
    console.error('请求处理失败', error)
    const status = error?.status ?? (error?.message === 'Invalid expiresAt value' ? 400 : 500)
    const message = error?.message ?? '服务器异常'
    if (!res.headersSent) {
      sendJson(res, status, { message })
    } else {
      res.end()
    }
  }
})

server.listen(port, () => {
  console.log(`Paste 服务已启动，端口 ${port}`)
})

function findRoute(method, pathname) {
  for (const route of compiledRoutes) {
    if (route.method !== method) continue
    const match = pathname.match(route.regex)
    if (!match) continue

    const params = {}
    route.paramNames.forEach((name, index) => {
      const value = match[index + 1]
      params[name] = value ? decodeURIComponent(value) : value
    })

    return { ...route, params }
  }
  return null
}

const MAX_JSON_SIZE = 1024 * 1024

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalLength = 0

    const onData = (chunk) => {
      totalLength += chunk.length
      if (totalLength > MAX_JSON_SIZE) {
        cleanup()
        const error = new Error('请求体过大')
        error.status = 413
        reject(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    }

    const onEnd = () => {
      cleanup()
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        const parsed = raw.length > 0 ? JSON.parse(raw) : {}
        resolve(parsed ?? {})
      } catch (error) {
        const parseError = new Error('请求体不是合法的 JSON')
        parseError.status = 400
        reject(parseError)
      }
    }

    const onError = (error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
    }

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
  })
}

function handleHealth({ res }) {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}

function handleMetrics({ res }) {
  const body = renderMetrics()
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.end(body)
}

async function handleListPastes({ res, query, userId, baseUrl }) {
  const data = await repository.list(userId, {
    page: query.page,
    pageSize: query.pageSize,
    visibility: query.visibility,
    status: query.status,
  })

  const effectiveBase = publicBaseUrl || baseUrl
  sendJson(res, 200, {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      shareUrl: `${effectiveBase}/share/${item.shareId}`,
    })),
  })
}

async function handleCreatePaste({ res, body = {}, userId, baseUrl }) {
  const { title, content, visibility, expiresAt } = body ?? {}
  const paste = await repository.create(userId, {
    title,
    content,
    visibility,
    expiresAt,
  })

  const effectiveBase = publicBaseUrl || baseUrl
  sendJson(res, 201, {
    ...paste,
    shareUrl: `${effectiveBase}/share/${paste.shareId}`,
  })
}

async function handleGetPaste({ res, params, userId, baseUrl }) {
  const paste = await repository.findById(userId, params.id)
  if (!paste) {
    sendJson(res, 404, { message: 'Paste 不存在' })
    return
  }

  const effectiveBase = publicBaseUrl || baseUrl
  sendJson(res, 200, {
    ...paste,
    shareUrl: `${effectiveBase}/share/${paste.shareId}`,
  })
}

async function handleUpdatePaste({ res, params, body = {}, userId, baseUrl }) {
  const updates = {}
  if (Object.hasOwn(body, 'title')) updates.title = body.title
  if (Object.hasOwn(body, 'visibility')) updates.visibility = body.visibility
  if (Object.hasOwn(body, 'expiresAt')) updates.expiresAt = body.expiresAt
  if (Object.hasOwn(body, 'content')) updates.content = body.content

  const paste = await repository.update(userId, params.id, updates)
  if (!paste) {
    sendJson(res, 404, { message: 'Paste 不存在' })
    return
  }

  const effectiveBase = publicBaseUrl || baseUrl
  sendJson(res, 200, {
    ...paste,
    shareUrl: `${effectiveBase}/share/${paste.shareId}`,
  })
}

async function handleDeletePaste({ res, params, userId }) {
  const deleted = await repository.delete(userId, params.id)
  if (!deleted) {
    sendJson(res, 404, { message: 'Paste 不存在' })
    return
  }

  res.statusCode = 204
  res.end()
}

async function handleGetShare({ res, params }) {
  const paste = await repository.findByShareId(params.shareId)
  if (!paste) {
    shareErrorCounter.inc({ reason: 'not_found' })
    sendJson(res, 404, { message: '分享链接不存在' })
    return
  }

  if (paste.visibility === 'private') {
    shareErrorCounter.inc({ reason: 'private' })
    sendJson(res, 403, { message: '分享链接不可访问' })
    return
  }

  if (repository.isExpired(paste)) {
    shareErrorCounter.inc({ reason: 'expired' })
    sendJson(res, 410, { message: '分享链接已过期' })
    return
  }

  shareViewCounter.inc()

  sendJson(res, 200, {
    id: paste.id,
    title: paste.title,
    content: paste.content,
    visibility: paste.visibility,
    expiresAt: paste.expiresAt,
  })
}

function getUserId(req) {
  const headerValue = req.headers['x-user-id']
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? defaultUserId
  }
  return headerValue ?? defaultUserId
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto']
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]?.trim()
      : undefined
  const scheme = protocol || 'http'
  const host = req.headers.host ?? 'localhost'
  return `${scheme}://${host}`
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-user-id')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type')
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload ?? {})
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}
