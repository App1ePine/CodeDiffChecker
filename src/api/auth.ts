import { http } from './http'
import type { User } from './types'

export type LoginPayload = {
  username: string
  password: string
}

export type RegisterPayload = {
  username: string
  email: string
  password: string
  confirmPassword: string
  nickname: string
}

export type LoginResponse = {
  user: User
}

export type RegisterResponse = {
  user: User
}

export type MeResponse = {
  user: User
}

export async function login(payload: LoginPayload) {
  return http<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function register(payload: RegisterPayload) {
  return http<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchCurrentUser() {
  return http<MeResponse>('/api/auth/me')
}

export async function logout() {
  return http<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
  })
}
