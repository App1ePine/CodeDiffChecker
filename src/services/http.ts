import axios from 'axios'
import { clearAuth, getAuthToken } from '../stores/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const http = axios.create({
  baseURL,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    if (!config.headers) config.headers = {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
    }
    return Promise.reject(error)
  }
)

export default http
