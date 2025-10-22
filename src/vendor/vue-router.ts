import type { App, Component, Ref, ShallowRef } from 'vue'
import { computed, defineComponent, h, inject, readonly, ref, shallowRef } from 'vue'

export type RouteComponent = Component | (() => Promise<Component | { default: Component }>)

export interface RouteRecordRaw {
  path: string
  name?: string
  component: RouteComponent
  props?: boolean | Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface RouteLocationNormalized {
  fullPath: string
  path: string
  name?: string
  params: Record<string, string>
  query: Record<string, string | string[]>
  meta: Record<string, unknown>
}

export type RouteQuery = Record<string, string | number | boolean | Array<string | number | boolean>>

export type RouteLocationRaw =
  | string
  | {
      name?: string
      path?: string
      params?: Record<string, string | number | boolean>
      query?: RouteQuery
    }

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
) => void | boolean | RouteLocationRaw | Promise<void | boolean | RouteLocationRaw>

interface RouteRecordInternal extends RouteRecordRaw {
  loadedComponent?: Component
}

interface CompiledRouteRecord {
  record: RouteRecordInternal
  regex: RegExp
  keys: string[]
  isCatchAll: boolean
}

export interface RouterHistory {
  location(): string
  push(path: string): void
  replace(path: string): void
  listen(callback: () => void): () => void
}

const ROUTER_KEY = Symbol('SIMPLE_ROUTER')
const ROUTE_KEY = Symbol('SIMPLE_ROUTE')
const ACTIVE_RECORD_KEY = Symbol('SIMPLE_ACTIVE_RECORD')
const ACTIVE_COMPONENT_KEY = Symbol('SIMPLE_ACTIVE_COMPONENT')

const escapeSegment = (segment: string) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const compileRoute = (record: RouteRecordInternal): CompiledRouteRecord => {
  if (record.path === '/:pathMatch(.*)*') {
    return {
      record,
      regex: /^\/(.*)$/,
      keys: ['pathMatch'],
      isCatchAll: true,
    }
  }

  const segments = record.path.split('/').filter((segment) => segment.length > 0)
  const keys: string[] = []
  const patternSegments = segments.map((segment) => {
    if (segment.startsWith(':')) {
      const paramName = segment.slice(1)
      keys.push(paramName)
      return '([^/]+)'
    }
    return escapeSegment(segment)
  })

  let pattern = '^'
  pattern += segments.length ? `/${patternSegments.join('/')}` : '/'
  pattern += '$'

  return {
    record,
    regex: new RegExp(pattern),
    keys,
    isCatchAll: false,
  }
}

const normalizePath = (path: string) => {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

const parseQuery = (search: string | undefined) => {
  const query: Record<string, string | string[]> = {}
  if (!search) return query
  const searchString = search.startsWith('?') ? search.slice(1) : search
  const searchParams = new URLSearchParams(searchString)
  for (const [key, value] of searchParams.entries()) {
    if (query[key]) {
      const existing = query[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        query[key] = [existing, value]
      }
    } else {
      query[key] = value
    }
  }
  return query
}

const stringifyQuery = (query: Record<string, string | string[]>) => {
  const searchParams = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item))
    } else {
      searchParams.append(key, value)
    }
  })
  const result = searchParams.toString()
  return result ? `?${result}` : ''
}

const normalizeQuery = (query?: RouteQuery) => {
  const normalized: Record<string, string | string[]> = {}
  if (!query) return normalized
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item))
      return
    }
    normalized[key] = String(value)
  })
  return normalized
}

const fillParams = (path: string, params: Record<string, string>) => {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params[key]
    if (value === undefined) {
      throw new Error(`Missing required param "${key}"`)
    }
    return encodeURIComponent(value)
  })
}

const resolveComponent = async (component: RouteComponent) => {
  const resolved = typeof component === 'function' ? await component() : component
  return (resolved as { default?: Component }).default ?? (resolved as Component)
}

const isObjectRoute = (value: RouteLocationRaw): value is Exclude<RouteLocationRaw, string> =>
  typeof value === 'object' && value !== null

interface ResolvedTarget {
  record: RouteRecordInternal
  location: RouteLocationNormalized
}

export interface RouterOptions {
  history?: RouterHistory
  routes: RouteRecordRaw[]
}

export interface Router {
  currentRoute: Readonly<Ref<RouteLocationNormalized>>
  push(to: RouteLocationRaw): Promise<RouteLocationNormalized | void>
  replace(to: RouteLocationRaw): Promise<RouteLocationNormalized | void>
  resolve(to: RouteLocationRaw): ResolvedTarget
  beforeEach(guard: NavigationGuard): () => void
  install(app: App): void
}

export const createWebHistory = (base = ''): RouterHistory => {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const createHref = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalizedBase}${normalizedPath}` || '/'
  }

  return {
    location() {
      if (typeof window === 'undefined') return '/'
      const { pathname, search } = window.location
      const withoutBase =
        normalizedBase && pathname.startsWith(normalizedBase) ? pathname.slice(normalizedBase.length) || '/' : pathname
      return `${withoutBase}${search}` || '/'
    },
    push(path: string) {
      if (typeof window === 'undefined') return
      window.history.pushState({}, '', createHref(path))
    },
    replace(path: string) {
      if (typeof window === 'undefined') return
      window.history.replaceState({}, '', createHref(path))
    },
    listen(callback: () => void) {
      if (typeof window === 'undefined') return () => {}
      const handler = () => callback()
      window.addEventListener('popstate', handler)
      return () => window.removeEventListener('popstate', handler)
    },
  }
}

export const createRouter = (options: RouterOptions): Router => {
  const history = options.history ?? createWebHistory()
  const beforeGuards: NavigationGuard[] = []
  const currentRoute = ref<RouteLocationNormalized>({
    fullPath: '/',
    path: '/',
    name: undefined,
    params: {},
    query: {},
    meta: {},
  })
  const activeRecord = ref<RouteRecordInternal | null>(null)
  const currentComponent = shallowRef<Component | null>(null)

  const records: RouteRecordInternal[] = options.routes.map((record) => ({ ...record }))
  const compiled: CompiledRouteRecord[] = records.map(compileRoute)
  const nameMap = new Map<string, RouteRecordInternal>()

  records.forEach((record) => {
    if (record.name) {
      nameMap.set(String(record.name), record)
    }
  })

  const catchAllRecord = compiled.find((item) => item.isCatchAll) ?? null

  const matchRoute = (path: string) => {
    for (const entry of compiled) {
      const match = entry.regex.exec(path)
      if (match) {
        const params: Record<string, string> = {}
        entry.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1] ?? '')
        })
        return { record: entry.record, params }
      }
    }
    return null
  }

  const resolve = (to: RouteLocationRaw): ResolvedTarget => {
    if (!isObjectRoute(to)) {
      const [pathname, search] = to.split('?')
      const path = normalizePath(pathname)
      const query = parseQuery(search ? `?${search}` : '')
      const matched = matchRoute(path)
      const targetRecord = matched?.record ?? catchAllRecord?.record ?? records[0]
      const params = matched?.params ?? (targetRecord === catchAllRecord?.record ? { pathMatch: path.slice(1) } : {})
      const meta = { ...(targetRecord?.meta ?? {}) }
      return {
        record: targetRecord,
        location: {
          fullPath: `${path}${stringifyQuery(query)}`,
          path,
          name: targetRecord?.name,
          params,
          query,
          meta,
        },
      }
    }

    if (to.name) {
      const record = nameMap.get(String(to.name)) ?? catchAllRecord?.record
      if (!record) {
        throw new Error(`Named route "${String(to.name)}" is not defined`)
      }
      const params: Record<string, string> = {}
      Object.entries(to.params ?? {}).forEach(([key, value]) => {
        params[key] = String(value)
      })
      const path = record.path === '/:pathMatch(.*)*' ? `/${params.pathMatch ?? ''}` : fillParams(record.path, params)
      const query = normalizeQuery(to.query)
      const meta = { ...(record.meta ?? {}) }
      return {
        record,
        location: {
          fullPath: `${normalizePath(path)}${stringifyQuery(query)}`,
          path: normalizePath(path),
          name: record.name,
          params,
          query,
          meta,
        },
      }
    }

    if (to.path) {
      const path = normalizePath(to.path)
      const query = normalizeQuery(to.query)
      const matched = matchRoute(path)
      const targetRecord = matched?.record ?? catchAllRecord?.record ?? records[0]
      const params = matched?.params ?? (targetRecord === catchAllRecord?.record ? { pathMatch: path.slice(1) } : {})
      const meta = { ...(targetRecord?.meta ?? {}) }
      return {
        record: targetRecord,
        location: {
          fullPath: `${path}${stringifyQuery(query)}`,
          path,
          name: targetRecord?.name,
          params,
          query,
          meta,
        },
      }
    }

    throw new Error('Invalid route location')
  }

  const runGuards = async (target: ResolvedTarget): Promise<RouteLocationNormalized | false> => {
    const from = currentRoute.value
    for (const guard of beforeGuards) {
      const result = await guard(target.location, from)
      if (result === false) return false
      if (typeof result === 'string' || (typeof result === 'object' && result !== null)) {
        const redirectTarget = resolve(result as RouteLocationRaw)
        return runGuards(redirectTarget)
      }
    }
    return target.location
  }

  const applyNavigation = async (
    target: ResolvedTarget,
    options: { replace?: boolean; skipHistory?: boolean } = {}
  ): Promise<RouteLocationNormalized | void> => {
    const guardResult = await runGuards(target)
    if (!guardResult) return

    const component = target.record.loadedComponent ?? (await resolveComponent(target.record.component))
    target.record.loadedComponent = component

    if (!options.skipHistory) {
      const { fullPath } = target.location
      if (options.replace) history.replace(fullPath)
      else history.push(fullPath)
    }

    activeRecord.value = target.record
    currentComponent.value = component
    currentRoute.value = target.location
    return target.location
  }

  const navigate = (to: RouteLocationRaw, options?: { replace?: boolean; skipHistory?: boolean }) => {
    const target = resolve(to)
    return applyNavigation(target, options)
  }

  const push = (to: RouteLocationRaw) => navigate(to)
  const replace = (to: RouteLocationRaw) => navigate(to, { replace: true })

  const install = (app: App) => {
    app.provide(ROUTER_KEY, router)
    app.provide(ROUTE_KEY, readonly(currentRoute))
    app.provide(ACTIVE_RECORD_KEY, activeRecord)
    app.provide(ACTIVE_COMPONENT_KEY, currentComponent)
    app.component('RouterLink', RouterLink)
    app.component('RouterView', RouterView)

    void navigate(history.location(), { replace: true, skipHistory: true })

    history.listen(() => {
      void navigate(history.location(), { replace: true, skipHistory: true })
    })
  }

  const beforeEach = (guard: NavigationGuard) => {
    beforeGuards.push(guard)
    return () => {
      const index = beforeGuards.indexOf(guard)
      if (index >= 0) beforeGuards.splice(index, 1)
    }
  }

  const router: Router = {
    currentRoute: readonly(currentRoute),
    push,
    replace,
    resolve,
    beforeEach,
    install,
  }

  return router
}

export const useRouter = (): Router => {
  const router = inject<Router>(ROUTER_KEY)
  if (!router) {
    throw new Error('Router instance is not provided')
  }
  return router
}

export const useRoute = (): Readonly<Ref<RouteLocationNormalized>> => {
  const route = inject<Readonly<Ref<RouteLocationNormalized>>>(ROUTE_KEY)
  if (!route) {
    throw new Error('Route location is not provided')
  }
  return route
}

const RouterLink = defineComponent({
  name: 'RouterLink',
  props: {
    to: { type: [String, Object], required: true },
    replace: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const router = useRouter()
    const resolved = computed(() => router.resolve(props.to as RouteLocationRaw).location)
    const isActive = computed(() => router.currentRoute.value.fullPath === resolved.value.fullPath)

    const navigate = (event: MouseEvent) => {
      event.preventDefault()
      if (props.replace) router.replace(props.to as RouteLocationRaw)
      else router.push(props.to as RouteLocationRaw)
    }

    return () =>
      h(
        'a',
        {
          href: resolved.value.fullPath,
          onClick: navigate,
          class: { 'router-link-active': isActive.value },
        },
        slots.default ? slots.default({ href: resolved.value.fullPath, isActive: isActive.value }) : undefined
      )
  },
})

const RouterView = defineComponent({
  name: 'RouterView',
  setup() {
    const route = useRoute()
    const activeRecord = inject<Ref<RouteRecordInternal | null>>(ACTIVE_RECORD_KEY, ref(null))
    const activeComponent = inject<ShallowRef<Component | null>>(ACTIVE_COMPONENT_KEY, shallowRef(null))

    return () => {
      const component = activeComponent.value
      if (!component) return null

      const record = activeRecord.value
      let props: Record<string, unknown> = {}
      if (record?.props === true) {
        props = { ...route.value.params }
      } else if (record?.props && typeof record.props === 'object') {
        props = { ...record.props }
      }

      return h(component, props)
    }
  },
})
export { RouterLink, RouterView }
