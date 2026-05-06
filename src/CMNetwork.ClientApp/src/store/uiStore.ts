import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface UIState {
  theme: ThemeMode
  sidebarOpen: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
  closeSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarOpen: true,
      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }))
      },
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },
      closeSidebar: () => {
        set({ sidebarOpen: false })
      },
    }),
    {
      name: 'cmn-ui',
      partialize: (state) => ({
        theme: state.theme,
      }),
    },
  ),
)
