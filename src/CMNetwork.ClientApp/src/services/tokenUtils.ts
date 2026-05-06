export const isTokenLikelyValid = (token: string | null): boolean => {
  if (!token || token.split('.').length !== 3) {
    return false
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    if (!payload.exp) {
      return true
    }

    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}
