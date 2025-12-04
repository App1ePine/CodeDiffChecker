export type User = {
  id: number
  username: string
  email: string
  nickname: string
  createdAt?: string
  updatedAt?: string
}

export type ShareSummary = {
  id: number
  slug: string
  title: string
  hidden: boolean
  hasPassword: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  url: string
}

export type ShareDetail = {
  slug: string
  title: string
  leftContent: string
  rightContent: string
  ownerName: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type PublicShareSummary = {
  slug: string
  title: string
  ownerName: string
  hasPassword: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}
