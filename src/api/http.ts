import { ApiError } from './types'

const PUBLIC_API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL

type HttpOptions = RequestInit & {
  parse?: 'json' | 'text'
}

export async function http<TResponse = unknown>(path: string, options: HttpOptions = {}): Promise<TResponse> {
  const { headers, parse, ...rest } = options

  const response = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    ...rest,
  })

  const wantsJson = parse === 'json' || (!parse && response.headers.get('content-type')?.includes('application/json'))

  let payload: unknown = null
  if (response.status !== 204) {
    try {
      if (wantsJson) {
        payload = await response.json()
      } else {
        payload = await response.text()
      }
    } catch (error) {
      if (wantsJson) {
        console.warn('Failed to parse JSON response', error)
      }
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : response.statusText) || 'Request failed'
    throw new ApiError(message, response.status, payload)
  }

  return payload as TResponse
}
