import { defineStore } from '@/lib/pinia'
import { computed, ref, watch } from 'vue'

export interface UserProfile {
  id?: string
  username?: string
  email?: string
  [key: string]: unknown
}

interface PersistedState {
  token: string | null
  currentUser: UserProfile | null
}

const STORAGE_KEY = 'code-diff-checker:user'

const readPersistedState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return { token: null, currentUser: null }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { token: null, currentUser: null }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      token: parsed.token ?? null,
      currentUser: parsed.currentUser ?? null,
    }
  } catch (error) {
    window.localStorage.removeItem(STORAGE_KEY)
    return { token: null, currentUser: null }
  }
}

const persistState = (state: PersistedState) => {
  if (typeof window === 'undefined') return
  if (!state.token && !state.currentUser) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useUserStore = defineStore('user', () => {
  const persisted = readPersistedState()

  const token = ref<string | null>(persisted.token)
  const currentUser = ref<UserProfile | null>(persisted.currentUser)

  const isAuthenticated = computed(() => Boolean(token.value))

  const login = (jwt: string, user: UserProfile) => {
    token.value = jwt
    currentUser.value = user
  }

  const logout = () => {
    token.value = null
    currentUser.value = null
  }

  watch(
    [token, currentUser],
    () => {
      persistState({ token: token.value, currentUser: currentUser.value })
    },
    { deep: true }
  )

  return {
    token,
    currentUser,
    isAuthenticated,
    login,
    logout,
  }
})
