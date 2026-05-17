import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isTokenLikelyValid } from '../services/tokenUtils'
import { authService } from '../services/authService'
import type { LoginCredentials, Role, User } from '../types/auth'

interface MfaPending {
  email: string
  mfaSessionToken: string
}

interface LoginBlockedVerificationState {
  email: string
  message: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  selectedRole: Role | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  mfaPending: MfaPending | null
  loginBlockedVerification: LoginBlockedVerificationState | null
  login: (credentials: LoginCredentials, recaptchaToken?: string) => Promise<'ok' | 'mfa' | 'verify-customer-otp' | 'error'>
  completeMfaLogin: (code: string) => Promise<boolean>
  logout: () => Promise<void>
  switchRole: (role: Role) => void
  setTokens: (accessToken: string, refreshToken: string) => void
}

type LoginErrorResponse = {
  message?: string
  requiresCustomerOtpVerification?: boolean
  email?: string
}

const getLoginErrorResponse = (error: unknown): LoginErrorResponse | null => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null
  }

  const response = error.response

  if (!response || typeof response !== 'object' || !('data' in response)) {
    return null
  }

  const { data } = response

  return data && typeof data === 'object' ? (data as LoginErrorResponse) : null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      selectedRole: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      mfaPending: null,
      loginBlockedVerification: null,

      login: async (credentials, recaptchaToken) => {
        set({ loading: true, error: null })
        try {
          const response = await authService.login(credentials, recaptchaToken)

          if (response.requiresMfa && response.mfaSessionToken) {
            set({
              loading: false,
              mfaPending: { email: credentials.email, mfaSessionToken: response.mfaSessionToken },
            })
            return 'mfa'
          }

          const accessToken = response.accessToken ?? response.token ?? ''
          set({
            user: response.user as User,
            token: accessToken,
            refreshToken: response.refreshToken ?? null,
            selectedRole: response.user.role as Role,
            isAuthenticated: true,
            loading: false,
            error: null,
            mfaPending: null,
            loginBlockedVerification: null,
          })
          return 'ok'
        } catch (error: unknown) {
          const loginError = getLoginErrorResponse(error)

          if (loginError?.requiresCustomerOtpVerification) {
            set({
              loading: false,
              error: loginError.message ?? 'Email verification is required before signing in.',
              isAuthenticated: false,
              loginBlockedVerification: {
                email: loginError.email ?? credentials.email,
                message: loginError.message ?? 'Email verification is required before signing in.',
              },
            })
            return 'verify-customer-otp'
          }

          set({
            loading: false,
            error: 'Invalid email or password.',
            isAuthenticated: false,
            loginBlockedVerification: null,
          })
          return 'error'
        }
      },

      completeMfaLogin: async (code) => {
        const { mfaPending } = get()
        if (!mfaPending) return false
        set({ loading: true, error: null })
        try {
          const response = await authService.verifyMfa(
            mfaPending.email,
            code,
            mfaPending.mfaSessionToken,
          )
          const accessToken = response.accessToken ?? response.token ?? ''
          set({
            user: response.user as User,
            token: accessToken,
            refreshToken: response.refreshToken ?? null,
            selectedRole: response.user.role as Role,
            isAuthenticated: true,
            loading: false,
            error: null,
            mfaPending: null,
            loginBlockedVerification: null,
          })
          return true
        } catch {
          set({ loading: false, error: 'Invalid MFA code.' })
          return false
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          await authService.logout(refreshToken ?? undefined)
        } catch {
          // Continue with local logout
        }
        set({
          user: null,
          token: null,
          refreshToken: null,
          selectedRole: null,
          isAuthenticated: false,
          error: null,
          loading: false,
          mfaPending: null,
          loginBlockedVerification: null,
        })
      },

      switchRole: (role: Role) => {
        const user = get().user
        if (user && user.role !== 'super-admin' && user.roles.includes(role)) {
          set({ selectedRole: role })
        }
      },

      setTokens: (accessToken, newRefreshToken) => {
        set({ token: accessToken, refreshToken: newRefreshToken })
      },
    }),
    {
      name: 'cmn-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        selectedRole: state.selectedRole,
        isAuthenticated: Boolean(state.user) && isTokenLikelyValid(state.token ?? null),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const valid = Boolean(state.user) && isTokenLikelyValid(state.token)
        state.isAuthenticated = valid
      },
    },
  ),
)
