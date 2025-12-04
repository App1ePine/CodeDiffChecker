import { http } from './http'
import type { PublicShareSummary, ShareDetail, ShareSummary } from './types'

export type CreateSharePayload = {
  title: string
  leftContent: string
  rightContent: string
  hidden?: boolean
  expiresAt?: string | null
}

export type UpdateSharePayload = {
  title?: string
  hidden?: boolean
  expiresAt?: string | null
}

export async function createShare(payload: CreateSharePayload) {
  return http<{ share: ShareSummary }>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function listShares() {
  return http<{ shares: ShareSummary[] }>('/api/shares')
}

export async function updateShare(id: number, payload: UpdateSharePayload) {
  return http<{ share: ShareSummary }>(`/api/shares/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteShare(id: number) {
  return http<{ success: boolean }>(`/api/shares/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchShareBySlug(slug: string) {
  return http<{ share: ShareDetail }>(`/api/public/shares/${slug}`)
}

export async function listPublicShares(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.pageSize) search.set('pageSize', String(params.pageSize))

  const query = search.toString()
  const path = query ? `/api/public/shares?${query}` : '/api/public/shares'
  return http<{ shares: PublicShareSummary[]; pagination: { page: number; pageSize: number; total: number } }>(path)
}
