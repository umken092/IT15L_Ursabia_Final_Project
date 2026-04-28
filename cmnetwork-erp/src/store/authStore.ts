import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isTokenLikelyValid } from '../services/mockAuthApi'
import { authService } from '../services/authService'
import type { LoginCredentials, Role, User } from '../types/auth'

interface AuthState {
  user: User | null
  token: string | null
  selectedRole: Role | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  switchRole: (role: Role) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      selectedRole: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      login: async (credentials) => {
        set({ loading: true, error: null })

        try {
          const response = await authService.login(credentials)

          set({
            user: response.user as User,
            token: response.token,
            selectedRole: response.user.role as Role,
            isAuthenticated: true,
            loading: false,
            error: null,
          })

          return true
        } catch {
          set({
            user: null,
            token: null,
            selectedRole: null,
            isAuthenticated: false,
            loading: false,
            error: 'Invalid email or password.',
          })

          return false
        }
      },
      logout: async () => {
        try {
          await authService.logout()
        } catch {
          // Continue with local logout even if API fails
        }
        set({
          user: null,
          token: null,
          selectedRole: null,
          isAuthenticated: false,
          error: null,
          loading: false,
        })
      },
      switchRole: (role: Role) => {
        const user = get().user
        if (user && user.roles.includes(role)) {
          set({ selectedRole: role })
        }
      },
    }),
    {
      name: 'cmn-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        selectedRole: state.selectedRole,
        isAuthenticated:
          Boolean(state.user) && isTokenLikelyValid(state.token ?? null),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }

        const valid = Boolean(state.user) && isTokenLikelyValid(state.token)
        state.isAuthenticated = valid
      },
    },
  ),
)
