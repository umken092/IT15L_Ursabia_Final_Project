import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isTokenLikelyValid } from '../services/tokenUtils'
import { authService } from '../services/authService'
import type { LoginCredentials, Role, User } from '../types/auth'

interface MfaPending {
  email: string
  mfaSessionToken: string
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
  login: (credentials: LoginCredentials, recaptchaToken?: string) => Promise<'ok' | 'mfa' | 'error'>
  completeMfaLogin: (code: string) => Promise<boolean>
  logout: () => Promise<void>
  switchRole: (role: Role) => void
  setTokens: (accessToken: string, refreshToken: string) => void
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
          })
          return 'ok'
        } catch {
          set({ loading: false, error: 'Invalid email or password.', isAuthenticated: false })
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
