import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LoginPayload, RegisterPayload } from '@/api/auth'
import { fetchCurrentUser, login, logout, register } from '@/api/auth'
import type { User } from '@/api/types'
import { ApiError } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const authLoading = ref(false)
  const isBootstrapped = ref(false)

  let bootstrapPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => Boolean(user.value))

  async function bootstrap() {
    if (isBootstrapped.value) return
    if (bootstrapPromise) {
      await bootstrapPromise
      return
    }

    bootstrapPromise = (async () => {
      try {
        const response = await fetchCurrentUser()
        user.value = response.user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          user.value = null
        } else {
          console.error('Failed to fetch current user', error)
        }
      } finally {
        isBootstrapped.value = true
        bootstrapPromise = null
      }
    })()

    await bootstrapPromise
  }

  async function loginUser(payload: LoginPayload) {
    authLoading.value = true
    try {
      const response = await login(payload)
      user.value = response.user
      isBootstrapped.value = true
      return response.user
    } finally {
      authLoading.value = false
    }
  }

  async function registerUser(payload: RegisterPayload) {
    authLoading.value = true
    try {
      const response = await register(payload)
      user.value = response.user
      isBootstrapped.value = true
      return response.user
    } finally {
      authLoading.value = false
    }
  }

  async function logoutUser() {
    try {
      await logout()
    } finally {
      user.value = null
    }
  }

  return {
    user,
    authLoading,
    isBootstrapped,
    isAuthenticated,
    bootstrap,
    loginUser,
    registerUser,
    logoutUser,
  }
})
