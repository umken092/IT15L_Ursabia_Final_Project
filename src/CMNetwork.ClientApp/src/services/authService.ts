import { apiClient } from './apiClient'
import type { LoginCredentials, User } from '../types/auth'

const isTransientLoginError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return true
  }

  const status = (error as { response?: { status?: number } }).response?.status
  return status === 502 || status === 503 || status === 504
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface VerifyCustomerOtpRequest {
  email: string
  otp: string
}

export interface VerifyCustomerOtpResponse {
  success: boolean
  message: string
}

export interface ResendCustomerOtpRequest {
  email: string
}

export interface AuthResponse {
  success: boolean
  message: string
}

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

export interface ForgotPasswordRequest {
  email: string
  resetUrl?: string
}

export interface ResetPasswordRequest {
  email: string
  token: string
  newPassword: string
}

export interface RegisterCustomerRequest {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  companyName?: string
}

export const authService = {
  login: async (credentials: LoginCredentials, recaptchaToken?: string): Promise<LoginApiResponse> => {
    try {
      const { data } = await apiClient.post<LoginApiResponse>('/auth/login', {
        email: credentials.email,
        password: credentials.password,
        recaptchaToken,
      })
      return data
    } catch (error) {
      // First click after deploy can hit cold-start/gateway hiccups.
      if (!isTransientLoginError(error)) {
        throw error
      }

      await delay(500)
      const { data } = await apiClient.post<LoginApiResponse>('/auth/login', {
        email: credentials.email,
        password: credentials.password,
        recaptchaToken,
      })
      return data
    }
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

  forgotPassword: async (payload: ForgotPasswordRequest): Promise<void> => {
    await apiClient.post('/auth/password/forgot', payload)
  },

  resetPassword: async (payload: ResetPasswordRequest): Promise<void> => {
    await apiClient.post('/auth/password/reset', payload)
  },

  registerCustomer: async (payload: RegisterCustomerRequest): Promise<void> => {
    await apiClient.post('/auth/register/customer', payload)
  },

  validateToken: async (token: string): Promise<boolean> => {
    try {
      const { data } = await apiClient.post<{ isValid: boolean }>('/auth/validate', { token })
      return data.isValid
    } catch {
      return false
    }
  },

  verifyCustomerOtp: async (payload: VerifyCustomerOtpRequest): Promise<VerifyCustomerOtpResponse> => {
    const { data } = await apiClient.post<VerifyCustomerOtpResponse>('/auth/verify/customer-otp', payload)
    return data
  },

  resendCustomerOtp: async (payload: ResendCustomerOtpRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/resend/customer-otp', payload)
    return data
  },
}
