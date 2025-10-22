import { computed, reactive, toRefs } from 'vue'

export interface AuthUser {
  id: number
  email: string
  username?: string | null
  [key: string]: unknown
}

interface AuthState {
  token: string | null
  user: AuthUser | null
}

const STORAGE_TOKEN_KEY = 'code-diff-checker:token'
const STORAGE_USER_KEY = 'code-diff-checker:user'

const storage = typeof window !== 'undefined' ? window.localStorage : undefined

const initialUser = (() => {
  if (!storage) return null
  const stored = storage.getItem(STORAGE_USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as AuthUser
  } catch (error) {
    console.warn('Failed to parse stored user info:', error)
    storage.removeItem(STORAGE_USER_KEY)
    return null
  }
})()

const state = reactive<AuthState>({
  token: storage?.getItem(STORAGE_TOKEN_KEY) ?? null,
  user: initialUser,
})

const isAuthenticated = computed(() => Boolean(state.token))

export function setAuthToken(token: string | null) {
  state.token = token
  if (!storage) return
  if (token) {
    storage.setItem(STORAGE_TOKEN_KEY, token)
  } else {
    storage.removeItem(STORAGE_TOKEN_KEY)
  }
}

export function setAuthUser(user: AuthUser | null) {
  state.user = user
  if (!storage) return
  if (user) {
    storage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  } else {
    storage.removeItem(STORAGE_USER_KEY)
  }
}

export function clearAuth() {
  setAuthToken(null)
  setAuthUser(null)
}

export function getAuthToken() {
  return state.token
}

export function useAuthStore() {
  const setAuth = (token: string, user?: AuthUser | null) => {
    setAuthToken(token)
    if (typeof user !== 'undefined') {
      setAuthUser(user)
    }
  }

  return {
    ...toRefs(state),
    isAuthenticated,
    setAuth,
    clearAuth,
    setUser: setAuthUser,
  }
}
