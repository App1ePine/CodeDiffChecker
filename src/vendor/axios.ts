export interface AxiosRequestConfig {
  baseURL?: string
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, unknown>
  data?: unknown
  withCredentials?: boolean
}

export interface AxiosResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: AxiosRequestConfig
}

export type AxiosPromise<T = unknown> = Promise<AxiosResponse<T>>

export interface AxiosError<T = unknown> extends Error {
  config: AxiosRequestConfig
  response?: AxiosResponse<T>
}

interface Interceptor<V> {
  fulfilled: (value: V) => V | Promise<V>
  rejected?: (error: unknown) => unknown
}

class InterceptorManager<V> {
  private handlers: Array<Interceptor<V> | null> = []

  use(fulfilled: Interceptor<V>['fulfilled'], rejected?: Interceptor<V>['rejected']) {
    this.handlers.push({ fulfilled, rejected })
    return this.handlers.length - 1
  }

  eject(id: number) {
    if (this.handlers[id]) {
      this.handlers[id] = null
    }
  }

  forEach(fn: (handler: Interceptor<V>) => void) {
    for (const handler of this.handlers) {
      if (handler) fn(handler)
    }
  }
}

const isFormData = (value: unknown): value is FormData => typeof FormData !== 'undefined' && value instanceof FormData
const isBlob = (value: unknown): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob

const combineURL = (baseURL: string | undefined, url: string | undefined) => {
  if (!url) return baseURL ?? ''
  if (/^https?:\/\//i.test(url)) return url
  if (!baseURL) return url
  const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}/${normalizedUrl}`
}

const serializeParams = (params?: Record<string, unknown>) => {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)))
      return
    }
    searchParams.append(key, String(value))
  })
  const result = searchParams.toString()
  return result ? `?${result}` : ''
}

const dispatchRequest = async <T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  const url = combineURL(config.baseURL, config.url) + serializeParams(config.params)
  const method = (config.method ?? 'GET').toUpperCase()
  const headers = new Headers(config.headers ?? {})
  const init: RequestInit = {
    method,
    headers,
  }

  if (config.withCredentials) {
    init.credentials = 'include'
  }

  if (config.data !== undefined && config.data !== null && method !== 'GET' && method !== 'HEAD') {
    if (isFormData(config.data) || isBlob(config.data) || config.data instanceof ArrayBuffer) {
      init.body = config.data as BodyInit
    } else if (typeof config.data === 'string') {
      init.body = config.data
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/plain;charset=utf-8')
    } else {
      init.body = JSON.stringify(config.data)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json;charset=utf-8')
    }
  }

  const response = await fetch(url, init)
  const headerMap: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headerMap[key] = value
  })

  const text = await response.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch (error) {
    data = text
  }

  const axiosResponse: AxiosResponse<T> = {
    data: data as T,
    status: response.status,
    statusText: response.statusText,
    headers: headerMap,
    config,
  }

  if (!response.ok) {
    const error = new Error(`Request failed with status code ${response.status}`) as AxiosError<T>
    error.config = config
    error.response = axiosResponse
    throw error
  }

  return axiosResponse
}

class AxiosCore {
  defaults: AxiosRequestConfig
  interceptors = {
    request: new InterceptorManager<AxiosRequestConfig>(),
    response: new InterceptorManager<AxiosResponse>(),
  }

  constructor(defaults?: AxiosRequestConfig) {
    this.defaults = defaults ? { ...defaults } : {}
  }

  request<T = unknown>(config: AxiosRequestConfig): AxiosPromise<T> {
    const mergedConfig: AxiosRequestConfig = {
      ...this.defaults,
      ...config,
      headers: { ...(this.defaults.headers ?? {}), ...(config.headers ?? {}) },
    }

    const chain: Array<{
      fulfilled: (value: unknown) => unknown | Promise<unknown>
      rejected?: (error: unknown) => unknown
    }> = []

    this.interceptors.request.forEach((interceptor) => {
      chain.unshift({
        fulfilled: interceptor.fulfilled,
        rejected: interceptor.rejected,
      })
    })

    chain.push({ fulfilled: dispatchRequest })

    this.interceptors.response.forEach((interceptor) => {
      chain.push({
        fulfilled: interceptor.fulfilled as (value: unknown) => unknown,
        rejected: interceptor.rejected,
      })
    })

    let promise: Promise<unknown> = Promise.resolve(mergedConfig)

    while (chain.length) {
      const { fulfilled, rejected } = chain.shift()!
      promise = promise.then(fulfilled, rejected)
    }

    return promise as AxiosPromise<T>
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig) {
    return this.request<T>({ ...config, url, method: 'GET' })
  }

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.request<T>({ ...config, url, data, method: 'POST' })
  }

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.request<T>({ ...config, url, data, method: 'PUT' })
  }
}

export interface AxiosInterceptorManager<V> {
  use(onFulfilled: (value: V) => V | Promise<V>, onRejected?: (error: unknown) => unknown): number
  eject(id: number): void
}

export interface AxiosInstance {
  (config: AxiosRequestConfig): AxiosPromise
  defaults: AxiosRequestConfig
  interceptors: {
    request: AxiosInterceptorManager<AxiosRequestConfig>
    response: AxiosInterceptorManager<AxiosResponse>
  }
  request<T = unknown>(config: AxiosRequestConfig): AxiosPromise<T>
  get<T = unknown>(url: string, config?: AxiosRequestConfig): AxiosPromise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): AxiosPromise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): AxiosPromise<T>
  create(config?: AxiosRequestConfig): AxiosInstance
}

const createInstance = (defaults?: AxiosRequestConfig): AxiosInstance => {
  const context = new AxiosCore(defaults)
  const instance = context.request.bind(context) as AxiosInstance

  Object.defineProperty(instance, 'defaults', {
    get: () => context.defaults,
    enumerable: true,
  })

  Object.defineProperty(instance, 'interceptors', {
    get: () => context.interceptors,
    enumerable: true,
  })

  instance.request = context.request.bind(context)
  instance.get = context.get.bind(context)
  instance.post = context.post.bind(context)
  instance.put = context.put.bind(context)
  instance.create = (config?: AxiosRequestConfig) => createInstance({ ...context.defaults, ...config })

  return instance
}

const axios = createInstance()

export default axios
