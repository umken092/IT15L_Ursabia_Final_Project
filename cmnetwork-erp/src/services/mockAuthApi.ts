import type { LoginCredentials, Role, User } from '../types/auth'

interface LoginResponse {
  token: string
  user: User
}

const roleKeywords: Array<{ keyword: string; role: Role }> = [
  { keyword: 'superadmin', role: 'super-admin' },
  { keyword: 'admin', role: 'super-admin' },
  { keyword: 'accountant', role: 'accountant' },
  { keyword: 'faculty', role: 'faculty-admin' },
  { keyword: 'employee', role: 'employee' },
  { keyword: 'viewer', role: 'authorized-viewer' },
  { keyword: 'executive', role: 'authorized-viewer' },
  { keyword: 'auditor', role: 'auditor' },
  { keyword: 'cfo', role: 'cfo' },
]

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const inferRolesFromEmail = (email: string): Role[] => {
  const value = normalizeEmail(email)
  const matches = roleKeywords
    .filter((entry) => value.includes(entry.keyword))
    .map((entry) => entry.role)

  if (value.includes('multi')) {
    return ['cfo', 'accountant']
  }

  if (matches.length === 0) {
    return ['employee']
  }

  return Array.from(new Set(matches))
}

const buildFakeJwt = (email: string, roles: Role[]): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub: email,
      roles,
      primaryRole: roles[0],
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    }),
  )

  return `${header}.${payload}.mock-signature`
}

export const mockLogin = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  const email = normalizeEmail(credentials.email)
  const password = credentials.password.trim()

  await new Promise((resolve) => setTimeout(resolve, 850))

  if (!email || !password) {
    throw new Error('Invalid email or password.')
  }

  const roles = inferRolesFromEmail(email)
  const primaryRole = roles[0]

  return {
    token: buildFakeJwt(email, roles),
    user: {
      id: `usr-${Date.now()}`,
      email,
      fullName: 'CMN User',
      role: primaryRole,
      roles,
      departmentId: primaryRole === 'faculty-admin' ? 'DEPT-FIN' : null,
    },
  }
}

export const isTokenLikelyValid = (token: string | null): boolean => {
  if (!token) {
    return false
  }

  return token.split('.').length === 3
}
