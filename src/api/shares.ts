import { http } from './http'
import type { ShareDetail, ShareSummary } from './types'

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
