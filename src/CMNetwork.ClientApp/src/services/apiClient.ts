import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL =
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || '/api'

// Singleton raw axios instance for refresh calls (avoids circular dependency)
const rawAxios = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })

class ApiClient {
  private instance: AxiosInstance
  private isRefreshing = false
  private refreshQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = []

  private flushRefreshQueue(token: string | null, error: unknown | null) {
    for (const queued of this.refreshQueue) {
      if (token) queued.resolve(token)
      else queued.reject(error)
    }
    this.refreshQueue = []
  }

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    })

    this.instance.interceptors.request.use((config: any) => {
      const token = useAuthStore.getState().token
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    this.instance.interceptors.response.use(
      (response: any) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any
        const status = error.response?.status

        // Retry idempotent GET requests once for transient gateway/server failures.
        const method = String(originalRequest?.method ?? 'get').toLowerCase()
        const isGet = method === 'get'
        const isTransientGateway = status === 502 || status === 503 || status === 504
        const isNetworkError = !error.response
        if (isGet && !originalRequest?._transientRetry && (isTransientGateway || isNetworkError)) {
          originalRequest._transientRetry = true
          await new Promise((resolve) => setTimeout(resolve, 500))
          return this.instance(originalRequest)
        }

        // On 401 try silent token refresh once
        if (status === 401 && !originalRequest._retry) {
          const { refreshToken, setTokens, logout } = useAuthStore.getState()

          if (!refreshToken) {
            logout()
            window.location.href = '/login'
            return Promise.reject(error)
          }

          if (this.isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              this.refreshQueue.push({ resolve, reject })
            }).then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return this.instance(originalRequest)
            })
          }

          originalRequest._retry = true
          this.isRefreshing = true

          try {
            const { data } = await rawAxios.post('/auth/refresh', { refreshToken })
            const { accessToken, refreshToken: newRefresh } = data as any
            setTokens(accessToken, newRefresh)
            this.flushRefreshQueue(accessToken, null)
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return this.instance(originalRequest)
          } catch (refreshError) {
            this.flushRefreshQueue(null, refreshError)
            logout()
            window.location.href = '/login'
            return Promise.reject(error)
          } finally {
            this.isRefreshing = false
          }
        }

        if (status === 403) {
          window.location.href = '/login'
        }

        return Promise.reject(error)
      },
    )
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config)
  }

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config)
  }

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config)
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config)
  }
}

export const apiClient = new ApiClient()
