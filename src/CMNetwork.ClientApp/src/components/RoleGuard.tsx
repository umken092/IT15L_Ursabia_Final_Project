import type { ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types/auth'

interface RoleGuardProps {
  allowedRoles: Role[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that restricts content to users with specific roles
 */
export const RoleGuard = ({ allowedRoles, children, fallback }: RoleGuardProps) => {
  const selectedRole = useAuthStore((state) => state.selectedRole)

  if (!selectedRole || !allowedRoles.includes(selectedRole)) {
    return (
      fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-center">
          <p className="text-red-700 font-semibold">Access Denied</p>
          <p className="text-red-600 text-sm mt-1">
            Your role does not have permission to access this resource.
          </p>
        </div>
      )
    )
  }

  return <>{children}</>
}

/**
 * Hook to check if user has required roles
 */
export const useRoleGuard = (requiredRoles: Role[]): boolean => {
  const selectedRole = useAuthStore((state) => state.selectedRole)
  return selectedRole ? requiredRoles.includes(selectedRole) : false
}

/**
 * Module-level role restrictions
 */
export const moduleRoleMap: Record<string, Role[]> = {
  // Super admin modules
  'user-management': ['super-admin'],
  'roles-permissions': ['super-admin'],
  'job-queue': ['super-admin'],
  'fiscal-periods': ['super-admin'],
  'integration-settings': ['super-admin'],
  'security-policy': ['super-admin'],
  'system-health': ['super-admin'],
  'admin-reports': ['super-admin'],
  'system-settings': ['super-admin'],
  // Accountant modules
  'general-ledger': ['accountant'],
  'accounts-payable': ['accountant'],
  'accounts-receivable': ['accountant'],
  'bank-reconciliation': ['accountant'],

  // Faculty admin modules
  'dept-reports': ['faculty-admin'],
  'fa-approvals': ['faculty-admin'],
  'fa-reports': ['faculty-admin'],
  // Legacy faculty-admin paths (kept for backwards compat)
  'department-report': ['faculty-admin'],
  approvals: ['faculty-admin'],
  'budget-cost-control': ['faculty-admin'],

  // Employee modules
  'expense-claims': ['employee'],
  payslips: ['employee'],
  profile: ['employee'],

  // Executive and audit modules
  'executive-summary': ['authorized-viewer'],
  'av-reports': ['authorized-viewer'],
  'audit-logs': ['auditor'],
  'sod-report': ['auditor'],
  'user-activity-timeline': ['auditor'],
  'general-ledger-inquiry': ['auditor'],
  'trial-balance': ['auditor'],
  'vendor-master': ['auditor'],
  'customer-master': ['auditor'],
  'balance-sheet': ['auditor', 'accountant', 'cfo'],
  'income-statement': ['auditor', 'accountant', 'cfo'],
  'ap-aging': ['auditor', 'accountant', 'cfo'],
  'ar-aging': ['auditor', 'accountant', 'cfo'],
  'evidence-archive': ['auditor'],
  'approvals-inbox': ['cfo'],
  'budget-control': ['cfo'],
  reports: ['accountant', 'auditor', 'cfo'],
  'financial-reports': ['accountant', 'auditor', 'cfo'],
}

/**
 * Check if user can access module
 */
export const canAccessModule = (moduleKey: string, userRole: Role | null): boolean => {
  if (!userRole) return false
  const allowedRoles = moduleRoleMap[moduleKey]
  return allowedRoles ? allowedRoles.includes(userRole) : false
}

/**
 * Get list of roles that can access a module
 */
export const getModuleRoles = (moduleKey: string): Role[] => {
  return moduleRoleMap[moduleKey] || []
}
