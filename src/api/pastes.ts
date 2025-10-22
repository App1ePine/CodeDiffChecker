export type VisibilityOption = 'public' | 'unlisted' | 'private'
export type StatusFilter = 'active' | 'expired'

export interface PasteSummary {
  id: string
  title: string
  visibility: VisibilityOption
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  shareId: string
  expired: boolean
}

export interface PasteSummaryWithUrl extends PasteSummary {
  shareUrl: string
}

export interface PasteDetail extends PasteSummaryWithUrl {
  content: string
}

export interface PasteListResponse {
  items: PasteSummaryWithUrl[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
}

export interface FetchPastesParams {
  page?: number
  pageSize?: number
  visibility?: VisibilityOption
  status?: StatusFilter
}

export interface CreatePastePayload {
  title: string
  content: string
  visibility: VisibilityOption
  expiresAt: string | null
}

export interface UpdatePastePayload {
  title?: string
  content?: string
  visibility?: VisibilityOption
  expiresAt?: string | null
}

const DEFAULT_API_BASE = 'http://localhost:4000'
const apiBase = (import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, '')
const defaultUserId = import.meta.env.VITE_DEFAULT_USER_ID ?? 'demo-user'

const withBase = (path: string) => `${apiBase}${path}`

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')
  if (!headers.has('x-user-id')) {
    headers.set('x-user-id', defaultUserId)
  }

  const response = await fetch(withBase(path), {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const payload = await response.json()
      if (payload && typeof payload.message === 'string') {
        message = payload.message
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function fetchPastes(params: FetchPastesParams = {}): Promise<PasteListResponse> {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))
  if (params.visibility) search.set('visibility', params.visibility)
  if (params.status) search.set('status', params.status)
  const query = search.toString()
  return request<PasteListResponse>(`/pastes${query ? `?${query}` : ''}`)
}

export async function createPaste(payload: CreatePastePayload): Promise<PasteDetail> {
  return request<PasteDetail>('/pastes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getPaste(id: string): Promise<PasteDetail> {
  return request<PasteDetail>(`/pastes/${id}`)
}

export async function updatePaste(id: string, payload: UpdatePastePayload): Promise<PasteDetail> {
  return request<PasteDetail>(`/pastes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deletePaste(id: string): Promise<void> {
  await request<void>(`/pastes/${id}`, { method: 'DELETE' })
}
