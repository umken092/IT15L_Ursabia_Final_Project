import { Navigate, useParams } from 'react-router-dom'
import type { JSX } from 'react'
import { useAuthStore } from '../store/authStore'
import { roleDashboardPath, type Role } from '../types/auth'
import { LazyDashboards } from './LazyDashboards'

const isRole = (value: string): value is Role => {
  return [
    'super-admin',
    'accountant',
    'faculty-admin',
    'employee',
    'authorized-viewer',
    'auditor',
    'cfo',
  ].includes(value)
}

const dashboardMap: Record<Role, () => JSX.Element> = {
  'super-admin': LazyDashboards.SuperAdminDashboard,
  accountant: LazyDashboards.AccountantDashboard,
  'faculty-admin': LazyDashboards.FacultyAdminDashboard,
  employee: LazyDashboards.EmployeeDashboard,
  'authorized-viewer': LazyDashboards.AuthorizedViewerDashboard,
  auditor: LazyDashboards.AuditorDashboard,
  cfo: LazyDashboards.CfoDashboard,
}

export const RoleDashboardPage = () => {
  const { role } = useParams<{ role: string }>()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!role || !isRole(role)) {
    return <Navigate to={roleDashboardPath(selectedRole || user.role)} replace />
  }

  if (role !== selectedRole && role !== user.role) {
    return <Navigate to={roleDashboardPath(selectedRole || user.role)} replace />
  }

  const displayRole = (isRole(role) ? role : selectedRole) as Role
  const DashboardComponent = dashboardMap[displayRole]

  if (!DashboardComponent) {
    return <Navigate to={roleDashboardPath(selectedRole || user.role)} replace />
  }

  return <DashboardComponent />
}
