import { apiClient } from './apiClient'
import type { LoginCredentials, User } from '../types/auth'

export interface LoginApiResponse {
  accessToken?: string
  refreshToken?: string
  token?: string          // back-compat
  requiresMfa?: boolean
  mfaSessionToken?: string
  email?: string
  user: User
}

export interface RefreshApiResponse {
  accessToken: string
  refreshToken: string
}

export interface MfaSetupApiResponse {
  sharedKey: string
  authenticatorUri: string
}

export const authService = {
  login: async (credentials: LoginCredentials, recaptchaToken?: string): Promise<LoginApiResponse> => {
    const { data } = await apiClient.post<LoginApiResponse>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
      recaptchaToken,
    })
    return data
  },

  verifyMfa: async (email: string, code: string, mfaSessionToken: string): Promise<LoginApiResponse> => {
    const { data } = await apiClient.post<LoginApiResponse>('/auth/mfa/verify', {
      email,
      code,
      mfaSessionToken,
    })
    return data
  },

  logout: async (refreshToken?: string): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : undefined)
    } catch {
      // Continue with local logout even if API fails
    }
  },

  refresh: async (refreshToken: string): Promise<RefreshApiResponse> => {
    const { data } = await apiClient.post<RefreshApiResponse>('/auth/refresh', { refreshToken })
    return data
  },

  getMfaSetup: async (): Promise<MfaSetupApiResponse> => {
    const { data } = await apiClient.get<MfaSetupApiResponse>('/auth/mfa/setup')
    return data
  },

  enableMfa: async (code: string): Promise<void> => {
    await apiClient.post('/auth/mfa/enable', { code })
  },

  disableMfa: async (password: string): Promise<void> => {
    await apiClient.post('/auth/mfa/disable', { password })
  },

  validateToken: async (token: string): Promise<boolean> => {
    try {
      const { data } = await apiClient.post<{ isValid: boolean }>('/auth/validate', { token })
      return data.isValid
    } catch {
      return false
    }
  },
}
