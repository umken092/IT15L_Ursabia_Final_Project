export type Role =
  | 'super-admin'
  | 'accountant'
  | 'faculty-admin'
  | 'employee'
  | 'authorized-viewer'
  | 'auditor'
  | 'cfo'
  | 'customer'

export interface User {
  id: string
  email: string
  fullName: string
  role: Role
  roles: Role[]
  departmentId: string | null
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe: boolean
}

export const roleLabels: Record<Role, string> = {
  'super-admin': 'Super Admin',
  accountant: 'Accountant',
  'faculty-admin': 'Faculty Admin',
  employee: 'Employee',
  'authorized-viewer': 'Authorized Viewer',
  auditor: 'Auditor',
  cfo: 'CFO',
  customer: 'Customer',
}

export const roleDashboardPath = (role: Role): string => `/dashboard/${role}`
