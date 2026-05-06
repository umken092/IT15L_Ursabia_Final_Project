import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { roleLabels, type Role } from '../types/auth'

const MainLayout = lazy(() => import('../layout/MainLayout').then((m) => ({ default: m.MainLayout })))
const LandingPage = lazy(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const MfaVerifyPage = lazy(() => import('../pages/MfaVerifyPage').then((m) => ({ default: m.MfaVerifyPage })))
const MfaSetupPage = lazy(() => import('../pages/MfaSetupPage').then((m) => ({ default: m.MfaSetupPage })))
const ModulePlaceholderPage = lazy(() =>
  import('../pages/ModulePlaceholderPage').then((m) => ({ default: m.ModulePlaceholderPage })),
)
const RoleDashboardPage = lazy(() =>
  import('../pages/RoleDashboardPage').then((m) => ({ default: m.RoleDashboardPage })),
)
const PrivateRoute = lazy(() => import('../routes/PrivateRoute').then((m) => ({ default: m.PrivateRoute })))

const APP_TITLE = 'CMNetwork ERP'

const modulePageTitles: Record<string, string> = {
  'user-management': 'User Management',
  'system-settings': 'System Settings',
  'general-ledger': 'General Ledger',
  'accounts-payable': 'Accounts Payable',
  'accounts-receivable': 'Accounts Receivable',
  'bank-reconciliation': 'Bank Reconciliation',
  'department-report': 'Department Report',
  approvals: 'Approvals',
  'dept-reports': 'Department Reports',
  'fa-approvals': 'Approvals Inbox',
  'fa-reports': 'Departmental Reports',
  'expense-claims': 'Expense Claims',
  payslips: 'Payslips',
  'executive-summary': 'Executive Summary',
  'av-reports': 'Reports',
  'audit-logs': 'Audit Logs',
  'sod-report': 'SOD Report',
  'user-activity-timeline': 'User Activity Timeline',
  'general-ledger-inquiry': 'General Ledger Inquiry',
  'trial-balance': 'Trial Balance',
  'vendor-master': 'Vendor Master',
  'customer-master': 'Customer Master',
  'balance-sheet': 'Balance Sheet',
  'income-statement': 'Income Statement',
  'ap-aging': 'AP Aging',
  'ar-aging': 'AR Aging',
  'evidence-archive': 'Evidence Archive',
  'approvals-inbox': 'Approvals Inbox',
  'budget-control': 'Budget Control',
  'budget-cost-control': 'Budget Control',
  'financial-reports': 'Financial Reports',
  profile: 'Profile',
  reports: 'Reports',
  'roles-permissions': 'Roles & Permissions',
  'job-queue': 'Job Queue',
  'fiscal-periods': 'Fiscal Periods',
  'integration-settings': 'Integration Settings',
  'security-policy': 'Security Policy',
  'system-health': 'System Health',
  'admin-reports': 'Admin Reports',
}

const labelize = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const isRole = (value: string): value is Role => value in roleLabels

const getPageTitle = (pathname: string) => {
  if (pathname === '/') {
    return APP_TITLE
  }

  if (pathname === '/login') {
    return `Sign In | ${APP_TITLE}`
  }

  if (pathname === '/mfa/verify') {
    return `MFA Verification | ${APP_TITLE}`
  }

  if (pathname === '/mfa/setup' || pathname === '/settings/mfa') {
    return `MFA Setup | ${APP_TITLE}`
  }

  const [, section, key] = pathname.split('/')

  if (section === 'dashboard' && key) {
    const dashboardLabel = isRole(key) ? roleLabels[key] : labelize(key)
    return `${dashboardLabel} Dashboard | ${APP_TITLE}`
  }

  if (section === 'module' && key) {
    return `${modulePageTitles[key] ?? labelize(key)} | ${APP_TITLE}`
  }

  return APP_TITLE
}

const DocumentTitle = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  return null
}

const RouterFallback = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--text)',
      background: 'var(--bg)',
    }}
  >
    Loading...
  </div>
)

export const AppRouter = () => {
  return (
    <Suspense fallback={<RouterFallback />}>
      <DocumentTitle />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa/verify" element={<MfaVerifyPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard/:role" element={<RoleDashboardPage />} />
            <Route path="/module/:moduleKey" element={<ModulePlaceholderPage />} />
            <Route path="/mfa/setup" element={<MfaSetupPage />} />
            <Route path="/settings/mfa" element={<MfaSetupPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
