import {
  computed,
  defineComponent,
  h,
  inject,
  reactive,
  ref,
  shallowRef,
  type App,
  type Component,
  type Ref
} from 'vue'

type RouteComponentLoader = () => Promise<Component | { default: Component }>

export type RouteComponent = Component | RouteComponentLoader

export interface RouteLocationNormalized {
  path: string
  params: Record<string, string>
  name?: string
  meta: Record<string, unknown>
}

type RoutePropsResolver = (route: RouteLocationNormalized) => Record<string, unknown>

type RoutePropsOption = boolean | Record<string, unknown> | RoutePropsResolver

export interface RouteRecordRaw {
  path: string
  name?: string
  component?: RouteComponent
  redirect?: string
  props?: RoutePropsOption
  meta?: Record<string, unknown>
}

interface InternalRouteRecord extends RouteRecordRaw {
  _resolved?: Component | null
  _isCatchAll?: boolean
}

interface NavigationOptions {
  replace?: boolean
  skipHistory?: boolean
}

interface RouterInjection {
  push: (path: string) => Promise<void>
  replace: (path: string) => Promise<void>
  currentRoute: RouteLocationNormalized
  _component: Ref<Component | null>
  _props: Ref<Record<string, unknown>>
  install(app: App): void
}

const ROUTER_SYMBOL = Symbol('router')

export function createWebHistory() {
  return { type: 'web' } as const
}

export function createRouter(options: { history: ReturnType<typeof createWebHistory>; routes: RouteRecordRaw[] }) {
  const records: InternalRouteRecord[] = []
  let catchAll: InternalRouteRecord | null = null

  for (const route of options.routes) {
    const record: InternalRouteRecord = { ...route }
    if (route.path.includes(':pathMatch')) {
      record._isCatchAll = true
      catchAll = record
    } else {
      records.push(record)
    }
  }

  const currentRoute = reactive<RouteLocationNormalized>({
    path: normalizePath(getCurrentPath()),
    params: {},
    name: undefined,
    meta: {}
  })
  const currentComponent = shallowRef<Component | null>(null)
  const currentProps = ref<Record<string, unknown>>({})

  let navigationToken = 0

  async function performNavigation(path: string, options: NavigationOptions = {}, depth = 0): Promise<void> {
    if (depth > 10) {
      throw new Error('Too many navigation redirects')
    }

    const normalized = normalizePath(path)
    const match = matchRoute(normalized)

    if (!match) {
      updateState(normalized, null, {})
      return
    }

    const { record, params } = match

    if (record.redirect) {
      await performNavigation(record.redirect, options, depth + 1)
      return
    }

    const token = ++navigationToken
    const component = await resolveComponent(record)

    if (token !== navigationToken) {
      return
    }

    updateState(normalized, record, params)
    currentComponent.value = component

    if (!options.skipHistory && typeof window !== 'undefined') {
      if (options.replace) {
        window.history.replaceState({}, '', normalized)
      } else {
        window.history.pushState({}, '', normalized)
      }
    }
  }

  function updateState(path: string, record: InternalRouteRecord | null, params: Record<string, string>) {
    currentRoute.path = path
    currentRoute.params = params
    currentRoute.name = record?.name
    currentRoute.meta = record?.meta ?? {}
    currentProps.value = resolveRouteProps(record, params, path)
  }

  function matchRoute(path: string) {
    for (const record of records) {
      const params = extractParams(record.path, path)
      if (params) {
        return { record, params }
      }
    }

    if (catchAll) {
      const params: Record<string, string> = { pathMatch: path.replace(/^\//, '') }
      return { record: catchAll, params }
    }

    return null
  }

  async function resolveComponent(record: InternalRouteRecord): Promise<Component | null> {
    if (!record.component) {
      return null
    }

    if (record._resolved) {
      return record._resolved
    }

    const loaded = typeof record.component === 'function' ? await record.component() : record.component
    const component = (loaded as { default?: Component }).default ?? (loaded as Component)
    record._resolved = component
    return component
  }

  function resolveRouteProps(
    record: InternalRouteRecord | null,
    params: Record<string, string>,
    path: string
  ) {
    if (!record || !record.props) {
      return {}
    }

    const location: RouteLocationNormalized = {
      path,
      params,
      name: record.name,
      meta: record.meta ?? {}
    }

    if (record.props === true) {
      return { ...params }
    }

    if (typeof record.props === 'function') {
      return record.props(location)
    }

    return record.props
  }

  function getCurrentPath() {
    if (typeof window === 'undefined') {
      return '/'
    }
    return window.location.pathname || '/'
  }

  function normalizePath(path: string) {
    if (!path) {
      return '/'
    }
    return path.startsWith('/') ? path : `/${path}`
  }

  function extractParams(pattern: string, path: string) {
    if (pattern === path) {
      return {}
    }

    const patternSegments = splitPath(pattern)
    const pathSegments = splitPath(path)

    if (patternSegments.length === 0 && pathSegments.length === 0) {
      return {}
    }

    if (patternSegments.length !== pathSegments.length) {
      return null
    }

    const params: Record<string, string> = {}

    for (let index = 0; index < patternSegments.length; index += 1) {
      const patternSegment = patternSegments[index]
      const pathSegment = pathSegments[index] ?? ''

      if (patternSegment.startsWith(':')) {
        const key = patternSegment.replace(/^:/, '').replace(/\(.*\)\*?$/, '')
        params[key] = decodeURIComponent(pathSegment)
        continue
      }

      if (patternSegment !== pathSegment) {
        return null
      }
    }

    return params
  }

  function splitPath(path: string) {
    return path.split('/').filter(Boolean)
  }

  const router: RouterInjection = {
    push: (target: string) => performNavigation(target),
    replace: (target: string) => performNavigation(target, { replace: true }),
    currentRoute,
    _component: currentComponent,
    _props: currentProps,
    install(app: App) {
      app.provide(ROUTER_SYMBOL, router)
      app.component('RouterLink', createRouterLink(router))
      app.component('RouterView', createRouterView(router))
      // 维持与 vue-router 类似的全局属性接口
      app.config.globalProperties.$router = router
      app.config.globalProperties.$route = currentRoute
    }
  }

  const initialPath = normalizePath(getCurrentPath())
  void performNavigation(initialPath, { replace: true, skipHistory: true })

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      void performNavigation(normalizePath(getCurrentPath()), { replace: true, skipHistory: true })
    })
  }

  return router
}

function createRouterLink(router: RouterInjection) {
  return defineComponent({
    name: 'RouterLink',
    props: {
      to: {
        type: String,
        required: true
      },
      custom: {
        type: Boolean,
        default: false
      }
    },
    setup(props, { slots }) {
      const href = computed(() => (props.to.startsWith('/') ? props.to : `/${props.to}`))
      const isActive = computed(() => router.currentRoute.path === href.value)

      const navigate = (event?: MouseEvent) => {
        if (event) {
          event.preventDefault()
        }
        void router.push(href.value)
      }

      return () => {
        if (props.custom && slots.default) {
          return slots.default({
            navigate,
            href: href.value,
            isActive: isActive.value
          })
        }

        return h(
          'a',
          {
            href: href.value,
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              navigate()
            }
          },
          slots.default ? slots.default() : href.value
        )
      }
    }
  })
}

function createRouterView(router: RouterInjection) {
  return defineComponent({
    name: 'RouterView',
    setup() {
      return () => {
        const component = router._component.value
        if (!component) {
          return null
        }
        return h(component, router._props.value)
      }
    }
  })
}

export function useRouter() {
  return inject<RouterInjection>(ROUTER_SYMBOL)
}
