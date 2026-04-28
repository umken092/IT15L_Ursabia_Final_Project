import { apiClient } from './apiClient'
import { mockLogin } from './mockAuthApi'
import type { LoginCredentials } from '../types/auth'

import type { User } from '../types/auth'

interface LoginResponse {
  token: string
  user: User
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>(
        '/auth/login',
        {
          email: credentials.email,
          password: credentials.password,
        },
      )
      return data
    } catch (error) {
      console.warn(
        'Real API login failed, falling back to mock auth',
        error,
      )
      return mockLogin(credentials)
    }
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      console.warn('Logout request failed, but proceeding with local logout')
    }
  },

  validateToken: async (token: string): Promise<boolean> => {
    try {
      const { data } = await apiClient.post<{ valid: boolean }>(
        '/auth/validate',
        { token },
      )
      return data.valid
    } catch {
      return false
    }
  },
}
