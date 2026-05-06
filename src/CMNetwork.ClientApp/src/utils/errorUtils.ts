import type { AxiosError } from 'axios'

/**
 * Extracts a human-readable error message from an Axios error or any Error.
 * Priority: server response `data.message` → `data.title` → `error.message` → fallback
 */
export function extractApiError(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (!error) return fallback

  const axiosError = error as AxiosError<{ message?: string; title?: string }>
  const serverMessage = axiosError.response?.data?.message ?? axiosError.response?.data?.title
  if (serverMessage && typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
    return serverMessage.trim()
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  return fallback
}
