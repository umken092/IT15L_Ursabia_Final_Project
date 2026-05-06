import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface NotificationState {
  toasts: ToastItem[]
  push: (type: ToastType, message: string) => void
  remove: (id: string) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }))

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }))
    }, 5000)
  },
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))
